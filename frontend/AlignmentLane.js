import Lane from './Lane.js';
import { colors, ipsColors, getTrack, fetchTrack,  msaToSeqPos, seqToMsaPos, extraTitleHeight} from './utilities.js';

// Visualizes multiple aligned and annotated protein sequences.
//
// data - sequence alignment data
// referenceID - Uniprot ID of the protein whose page will be displayed

const AlignmentLane = (graphLayout, laneLayout, dataModel, props) => {
    let data = dataModel.alignments;
    let referenceID = dataModel.uniprotId;

    let width = 0;
    let numSequences = data.length;
    let referenceSequence = "";
    let numAaDisplayed = Math.floor(props.width / 20);
    let highlightedAA = -1;
    let state = {
        trackMapping: "FETCH",
        annotations: {}
    }
    let msaMaps = {}; //Maps from msa position to sequence position for each sequence
    for (let i = 0; i < numSequences; i++) {
        if (data[i].ID === referenceID) {
            referenceSequence = data[i].seq;
        }
        msaMaps[data[i].ID] = msaToSeqPos(data[i].seq);
    }
    let referenceMapToMSA = seqToMsaPos(referenceSequence); //Mapping from position in main sequence to MSA

    let title = "Multiple Alignment";
    let lane = Lane(graphLayout, laneLayout, title, "alignments", true, props);
    lane.xAxisAnnotation();
    
    const yScale = d3.scale.linear()
        .domain([0, numSequences])
        .range(laneLayout.range());

    const appendDetails = (element, aminoAcid) => {
        element.append("<h4>" + title + "</h4>");
        let html = "<table class='mult-align-table'><tbody>";
        let mappedAminoAcid = coordinateMap(aminoAcid);
        for (let i = 0; i < numSequences; i++) {
            let msa = data[i];
            let seqText = msa.seq;
            let aa = seqText[mappedAminoAcid - 1];
            if (aa !== '-') {
                let seqName = msa.ID;
                let pos = positionWithinSequence(seqText, mappedAminoAcid - 1) + 1;

                let ann = data[i][mappedAminoAcid];

                html += "<tr><td>" + seqName + "</td><td>#" + pos + "</td>";

                if (ann) {
                    aa = `"<span style='border-radius: 3px; padding: 0 5px; background-color: ${ann.bg_color}
                                        ; color: ${ann.fg_color}'>${aa}</span>`;
                } else {
                    aa = "<span style='padding: 0 5px'>" + aa + "</span>";
                }

                html += "<td>" + aa + "</td>";
                html += "</tr>";

                if (ann) {
                    html += "<tr><td colspan='3' class='mult-align-annotation'>";
                    html += ann.ID + " " + ann.variant + " - " + ann.phenotype;
                    html += "</td></tr>";
                }

            }
        }
        html += "</tbody></table>";
        element.append(html);
    }

    const highlight = aminoAcid => {
        let mappedAminoAcid = coordinateMap(aminoAcid);
        if (mappedAminoAcid > xScaleCustom.domain()[0] && mappedAminoAcid < xScaleCustom.domain()[1]) {
            let x = xScaleCustom(mappedAminoAcid);
            let w = Math.max(xScaleCustom(mappedAminoAcid + 1) - x, 10);

            highlighted.group.attr("display", null);

            highlighted.rect
                .attr("x", x - w / 2)
                .attr("width", w);

            for (let i = 0; i < numSequences; i++) {
                highlighted.letters[i]
                .attr("x", x)
                .text(data[i].seq[mappedAminoAcid - 1]);
            }
        } else {
            highlighted.group.attr("display", "none");
        }
        highlightedAA = aminoAcid;
    }

    const unhighlight = () => {
        highlighted.group.attr("display", "none");
        highlightedAA = -1;
    }

    const hover = (aminoAcid, mouseY) => {
        let mappedAminoAcid = coordinateMap(aminoAcid);
        if (mappedAminoAcid >
            xScaleCustom.domain()[0] &&
            mappedAminoAcid <
            xScaleCustom.domain()[1]) {
            let x = xScaleCustom(mappedAminoAcid);
            let w = Math.max(xScaleCustom(mappedAminoAcid + 1) - x, 10);

            hovered.group.attr("display", null);

            hovered.rect
                .attr("x", x - w / 2)
                .attr("width", w);

            for (let i = 0; i < numSequences; i++) {
                hovered.letters[i]
                .attr("x", x)
                .text(data[i].seq[mappedAminoAcid - 1]);
            }
        } else {
            xScaleCustom.domain([
                Math.max(1, mappedAminoAcid - numAaDisplayed / 2) -
                0.5,
                Math.min(data[0].seq.length,
                mappedAminoAcid + numAaDisplayed / 2) +
                0.5
            ]);
            // Make sure to update the highlight
            if (highlightedAA > 0) {
                highlight(highlightedAA);
            }
            update();
        }
    }

    const unhover = () => {
        hovered.group.attr("display", "none");
    }

    const update = () => {
        updateRange();
        numAaDisplayed = Math.floor(width / 12);

        // Try to copy range from the main graph if mostly small
        let mainDomain = props.xScale.domain();
        let startPos = coordinateMap(Math.ceil(mainDomain[0]));
        let endPos = coordinateMap(Math.floor(mainDomain[1]));
        if (endPos - startPos < numAaDisplayed) {
            xScaleCustom.domain([startPos - 0.5, endPos + 0.5]);
        }
        letters[0][0].innerHTML = "";
        for (let i = 0; i < numSequences; i++) {
            let seqId = data[i].ID;
            let prevDisplayedX = -1e6;
            let ann = state.annotations[seqId]; //All annotation tracks for this protein

            let sequence = data[i].seq;
            for (let j = Math.ceil(xScaleCustom.domain()[0]); j < xScaleCustom.domain()[1]; j++) {
                let xPos = xScaleCustom(j);

                let text = sequence[j - 1];
                let annotated = false
                if (ann){
                    Object.keys(ann).map(key => {
                        if (ann[key].includes(j)){
                            annotated = true;
                            //If the current MSA position is in the annotation track, color it
                            letters.append("svg:rect")
                                .attr("x", xScaleCustom(j - 0.5) + 1)
                                .attr("y", yScale(i + 1) + 1)
                                .attr("width", xScaleCustom(j + 0.5) - xScaleCustom(j - 0.5) - 2)
                                .attr("height", yScale(i) - yScale(i + 1) - 2)
                                .attr("rx", "3")
                                .attr("ry", "3")
                                .attr("style", "fill:" + colors[key]);
                        }
                    })
                }
                

                let letter = letters.append("svg:text")
                    .attr("x", xPos)
                    .attr("y", yScale(i + 0.5))
                    .text(text);
                
                if (annotated) {
                    letter
                        .attr("fill", "white")
                        .attr("class", "annotation-font-bold")
                        .append("title")
                        .text(seqId + " " + j + " - " + ann.phenotype);
                }
                
                prevDisplayedX = xPos;
            }
        }
    }

    const updateRange = () => {
        width = $("#graph-container").width() - graphLayout.getMargin().left - graphLayout.getMargin().right;
        xScaleCustom = xScaleCustom.range([0, width]);
    }

    // Map amino acid position to amino acid position within an aligned sequence (skipping dashes)
    const coordinateMappingFunction = sequence => {
        let mappingArray = [0];
        for (let i = 0; i < sequence.length; i++) {
            if (sequence[i] !== "-") {
                mappingArray.push(i + 1);
            }
        }
        return function (pos) {
            return mappingArray[pos];
        }
    }

    // Count how many non-dashes are there in a sequence (==position within given sequence)
    const positionWithinSequence = (sequence, pos) => {
        let count = 0;
        for(let i = 0; i<pos; i++) {
            if(sequence[i]!=='-') {
                count++;
            }
        }
        return count;
    }
    
    let coordinateMap = coordinateMappingFunction(referenceSequence);
    let xScaleCustom = d3.scale.linear();
    xScaleCustom.domain([1 - 0.5, numAaDisplayed + 0.5]);
    updateRange();

    let group = graphLayout.addDataGroup(laneLayout, "alignments");

    // A group for all the letters
    let letters = group.append("g")
        .attr("class", "alignment-lane")
        .attr("width", graphLayout.getDataWidth())
        .attr("height", laneLayout.getHeight());
    
    // Create title for the row
    for (let i = 0; i < numSequences; i++) {
        let msaTitle = graphLayout.getEntire().append("svg")
            .attr("class", "msa-title")
            .attr("x", 0)
            .attr("y", graphLayout.getMargin().top + laneLayout.getY() + extraTitleHeight + yScale(i + 0.75))
        
        msaTitle.append("rect")
            .attr("height", 14)
            .attr("width", graphLayout.getMargin().left - props.leftColumnBorder)
            .style("fill", "lightgray");
        

        let currId = data[i].ID;
        let linkId;
        let displayId;
        
        if (currId.indexOf(":") > -1){
            linkId =  currId.split(":")[0];
            displayId = currId.split(":")[1];
        } else {
            linkId = currId;
            displayId = linkId;
        }
        
        let fontSize = "13px";
        if (!props.interactive){
            fontSize = "8px";
        }
        graphLayout.getEntire().append("text")
            .attr("x", graphLayout.getMargin().left - props.leftColumnBorder - 2)
            .attr("y", graphLayout.getMargin().top + laneLayout.getY() + extraTitleHeight + yScale(i + 0.75) + 2)
            .attr("width", graphLayout.getMargin().left - props.leftColumnBorder)
            .attr("height", 2)
            .attr("class", "line-title")
            .attr("style", `font-size: ${fontSize}`)
            .on("click", function() {
                window.open(`http://www.uniprot.org/uniprot/${linkId}`);
            })
            .text(displayId);

        let clickFunc = dir => {
            props.alignmentButtonCB(linkId, dir);
        }

        let active = false;
        if (props.uniprotId == linkId){
            active = true;
        }
    }

    // Hovered letters
    let hovered = {};
    hovered.group = graphLayout.getEntire().append("g")
        .attr("class", "alignment-lane-hover")
        .attr("transform", `translate(${graphLayout.getMargin().left}, ${(laneLayout.getY() + extraTitleHeight + graphLayout.getMargin().top)})`);
    
    hovered.rect =
        hovered.group.append("rect")
            .attr("height", laneLayout.getHeight());

    hovered.letters = [];
    for (let i = 0; i < numSequences; i++) {
        hovered.letters.push(hovered.group.append("text")
            .attr("y", yScale(i + 0.5)));
    }

    // Highlighted letters
    let highlighted = {};
    highlighted.group =
        graphLayout.getEntire().insert("g", ":first-child")
            .attr("class", "alignment-lane-highlight")
            .attr("transform",
                `translate(${graphLayout.getMargin().left}, ${laneLayout.getY() + extraTitleHeight + graphLayout.getMargin().top})`);
        
    highlighted.rect = highlighted.group.append("rect")
        .attr("height", laneLayout.getHeight());

    highlighted.letters = [];
    for (let i = 0; i < numSequences; i++) {
        highlighted.letters.push(highlighted.group.append("text")
            .attr("y", yScale(i + 0.5) ));
    }
    highlightedAA = -1;

    const getIntervals = async key => {
        if (state.trackMapping === "MAP"){
            //Map annotations in current model to others

            let trackData;
            if (Object.keys(dataModel).includes(key)){
                trackData = dataModel[key];
            } else if (Object.keys(ipsColors).includes(key)) {
                trackData = dataModel['ipsMotifs']['rows'].filter(obj => obj.name === key);
            } else {
                trackData = dataModel["siteSpecificAnnotations"]["rows"].filter(obj => obj.name === key.replace("_", " "));
            }
            if (trackData.length < 1){
                return false;
            }

            let annotations = getTrack(key, trackData);
            let mappedAnnotations = Object.keys(msaMaps).reduce((res, id) => {
                res[id] = annotations.map(x => msaMaps[id][referenceMapToMSA[x]])
            }, {});
            return mappedAnnotations;

        } else if (state.trackMapping === "FETCH"){

            let residues = await Promise.all(data.map(async x => {
                let uniprotId = x.ID;
                //Get annotations for other models
                let trackData;

                if (Object.keys(ipsColors).includes(key)){
                    trackData = await fetchTrack(uniprotId, "ips");
                    trackData = dataModel.mapTrack("ips", trackData);
                    trackData = trackData.rows.filter(obj => obj.name === key);

                } else {
                    if (key === "exons") {
                        key = "CCDS";
                    }  
                    trackData = await fetchTrack(uniprotId, key);
                    trackData = dataModel.mapTrack(key, trackData);
                    
                }
                if (trackData){

                    let out = getTrack(key, trackData);
                    return {id: uniprotId, seq: out};
                }
            }));
            let out = residues.reduce((res, x) => {
                res[x.id] = x.seq;
                return res;
            }, {});
            return out;
        }
    }
    const addIntervals = async (key) => {
        let intervals = await getIntervals(key);
        let annObj = {};
        annObj['color'] = "black";
        annObj['intervals'] = intervals;
        Object.keys(intervals).map(x => {
            if (!state.annotations[x]){
                state.annotations[x] = {};
            }
            state.annotations[x][key] = intervals[x];
        });
        update();
    }
    const removeIntervals = key => {
        Object.keys(state.annotations).map(x => {
            delete state.annotations[x][key];
        });
        update();
    }
    return Object.assign(
            {},
            {...lane, getIntervals, highlight, unhighlight, hover, unhover, 
            addIntervals, removeIntervals, update, updateRange, coordinateMappingFunction, 
            positionWithinSequence, appendDetails}
        )
}

export default AlignmentLane;