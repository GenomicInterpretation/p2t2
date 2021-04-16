import Lane from './Lane.js';
const ProteinSequenceLane = (graphLayout, laneLayout, sequence, exons, props) => {
    let seq = sequence;
    let group = graphLayout.addDataGroup(laneLayout, name);
    
    let exonG = group.append("g")
        .attr("width", graphLayout.getDataWidth())
        .attr("height", laneLayout.getHeight());

    const xPos = d => {
        return props.xScale(d.start - 0.5);
    }
    const barWidth = d => {
        return props.xScale(d.stop + 1) - props.xScale(d.start); 
    };

    let exonElements = exonG.selectAll("rect").data(exons)
        .enter()
        .append("svg:rect")
        .attr("x", xPos)
        .attr("y", 0)
        .attr("width", barWidth)
        .attr("height", laneLayout.getHeight())
        .attr("style", function (d) {
            return d.odd ? "fill:rgba(117,  25, 117, 0.3)" : "fill:rgba(224, 163, 102, 0.3)"
        });

    let letters = group.append("g")
        .attr("width", graphLayout.getDataWidth())
        .attr("height", laneLayout.getHeight())
        .attr("class", "protein-sequence");

    let letter = {};
    if (props.interactive){
        letter.group =
            graphLayout.getEntire().append("g")
                .attr("class", "protein-sequence-lane-highlight")
                .attr("transform", `translate(${graphLayout.getMargin().left}, ${(laneLayout.getY(false) + graphLayout.getMargin().top)})`);
        
        letter.numberBox = 
            letter.group.append("rect")
                .attr("id", "aa-number-rect")
                .attr("y", laneLayout.getY(false) - 1.25 * laneLayout.getHeight())
                .attr("height", laneLayout.getHeight())
                .attr("width", laneLayout.getHeight())

        letter.number = 
            letter.group.append("text")
                .attr("id", "aa-number-text")
                .attr("y", (laneLayout.getY(false) - 1.25 * laneLayout.getHeight()/2))

        letter.rect =
            letter.group.append("rect")
                .attr("height", laneLayout.getHeight())
                .attr("y", laneLayout.getY() - laneLayout.getY(false));

        letter.letter =
            letter.group.append("text")
                .attr("y", (laneLayout.getY() + laneLayout.getHeight() / 2));
    }

    const appendDetails = (element, aminoAcid, variant = false) => {
        let title = seq[aminoAcid - 1];
        if (variant){
            title = `${seq[aminoAcid - 1]} > ${variant.alt}`;
        }
        
        element.append(`<h4>AA #${aminoAcid} - <span class='aa-letter'>${title}</span></h4>`)
    }
    const hover = (aminoAcid, mouseY) => {
        let x = props.xScale(aminoAcid);
        let w = Math.max(props.xScale(aminoAcid + 1) - x, 10);

        letter.group.attr("display", null);

        letter.rect
            .attr("x", x - w / 2)
            .attr("width", w);

        letter.letter
            .attr("x", x)
            .text(seq[aminoAcid - 1]);

        letter.numberBox
            .attr("x", x - 1.5 * w)
            .attr("width", 3 * w)

        letter.number
            .attr("x", x)
            .text(aminoAcid)
    }
    const unhover = () => {
        letter.group.attr("display", "none");
    }
    const update = () => {
        exonElements
            .attr("x", xPos)
            .attr("width", barWidth);
        letters[0][0].innerHTML = "";

        let prevDisplayedX = -1e6;
        let wasSkipped = false; // We did not get to display previous letter
        let numPreviousDots = 0; // How many dots did we display so far
        let MAX_DOTS_IN_A_ROW = 1;
        for (let i = Math.ceil(props.xScale.domain()[0]) - 1; i < props.xScale.domain()[1]; i++) {
            let xPos = props.xScale(i + 1);

            if (xPos - prevDisplayedX > 10 && seq) {
                let text = seq[i];
                let ellipsis = false;

                if (wasSkipped) {
                    if (numPreviousDots < MAX_DOTS_IN_A_ROW) {
                        text = "\u2026";
                        ellipsis = true;
                        numPreviousDots++;
                    }
                    wasSkipped = false;
                }
                letters.append("svg:text")
                    .attr("x", xPos)
                    .attr("y", laneLayout.getHeight() / 2)
                    .text(text);
                prevDisplayedX = xPos;

                if (!ellipsis) {
                    numPreviousDots = 0;
                }
            } else {
                wasSkipped = true;
            }
        }
    }
    return Object.assign(
        {},
        {...Lane(graphLayout, laneLayout, "Protein Sequence", "sequence", true, props), 
        appendDetails, hover, unhover, update}
    )
}
export default ProteinSequenceLane;