import Lane from './Lane.js';
import { extraTitleHeight } from './utilities';

const GnomadLane = (graphLayout, laneLayout, data, props) => {

    let border = 5;
    let rangeWithoutBorder = [laneLayout.range()[0] - border, laneLayout.range()[1] + border];

    let yScale = d3.scale.log()
        .domain(data.yRange)
        .range(rangeWithoutBorder);

    let lane = Lane(graphLayout, laneLayout, "GnomAD AF", 'gnomad', false, props);
    lane.xAxisAnnotation();
    
    let yAxis = d3.svg.axis()
        .scale(yScale)
        .tickSize(3, 0)
        .ticks(5, ",.3%")
        .orient("left");

    graphLayout.getEntire().append("g")
        .attr("class", "y axis noselect")
        .attr("transform", "translate(" + (graphLayout.getMargin().left - props.leftColumnBorder) + "," + (laneLayout.getY() + graphLayout.getMargin().top) + ")")
        .call(yAxis);

    const transform = d => {
        return "translate(" + (props.xScale(d[0])) + "," + yScale(d[1]) + ")";
    };

    let group = graphLayout.addDataGroup(laneLayout, "gnomad");
    
    let hoverCircle = graphLayout.getData().append("svg:circle")
        .attr("class", "highlight-closest-circle")
        .attr("r", "2px")
        .attr("display", "none");

    let elements = group.selectAll("circle").data(data.data)
        .enter()
        .append("svg:circle")
        .attr("r", 2)
        .attr("transform", transform);

    let hoverText = graphLayout.getData().append("text")
        .attr("class", "highlight-closest-text")
        .attr("display", "none");

    const update = () => {
        elements.attr("transform", transform);
    }

    const hover = (aminoAcid, mouseY) => {
        // Find closest element
        let closest = {
            aa: -1,
            aaDistance: 1000000,
            y: -1,
            yDistance: 1000000,
            value: "",
            closer: function(aaDist, yDist) {
                if (aaDist < this.aaDistance) {
                    return true;
                }
                if (aaDist > this.aaDistance) {
                    return false;
                }
                if (yDist < this.yDistance) {
                    return true;
                }
                return false;
            }
        };

        let gnomadAfTuples = data.data;
        
        for (let i = 0; i < gnomadAfTuples.length; i++) {
            let aa = gnomadAfTuples[i][0];
            let value = gnomadAfTuples[i][1];
            let y = yScale(value) + laneLayout.getY();

            let aaDistance = Math.abs(aa - aminoAcid);
            let yDistance = Math.abs(y - mouseY);

            if (closest.closer(aaDistance, yDistance)) {
                closest.aa = aa;
                closest.aaDistance = aaDistance;
                closest.y = y + extraTitleHeight;
                closest.yDistance = yDistance;
                closest.value = value;
            }
        }

        if (closest.aa != -1) {
            // Found a closest entry
            // Highlight it!

            let color = "red";
            let valueFormat = d3.format(",.3%"); // Text to show on highlight

            hoverCircle
                .attr("cx", props.xScale(closest.aa))
                .attr("cy", closest.y)
                .attr("fill", color)
                .attr("display", null);

            let xText = props.xScale(closest.aa) + 25; // Right end of the line
            let fontSize = "8px";
            if (!props.interactive){
                fontSize = "5px";
            }
            hoverText
                .attr("x", xText)
                .attr("y", closest.y)
                .attr("fill", color)
                .attr("display", null)
                .attr("text-anchor", "start")
                .text(valueFormat(closest.value));

            // Correct for sliding out of screen
            let length = hoverText[0][0].clientWidth;

            if (xText + length > props.width) {
                xText = props.xScale(aminoAcid) - 5;
                hoverText
                    .attr("x", xText)
                    .attr("text-anchor", "end");
            }
        }
    }
    const unhover = () => {
        hoverCircle
            .attr("display", "none");
        hoverText
            .attr("display", "none");
    }
    return Object.assign(
            {},
            {...lane, update, hover, unhover}
        )
}
export default GnomadLane;