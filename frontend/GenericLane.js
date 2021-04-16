import { palette, spaceBetweenRows, extraTitleHeight } from './utilities.js';
import Lane from './Lane.js';

// rowLabels - one of "none", "color", "black"
const GenericLane = (graphLayout, laneLayout, data, rowLabels, props, titleCallback) => {
    let closest = false;
    if (laneLayout.getHidden()) {
        rowLabels = "none";
    }

    let yScale = d3.scale.linear()
        .domain(data.yDomain(spaceBetweenRows))
        .range(laneLayout.reverseRange());

    let lane = Lane(graphLayout, laneLayout, data.title, data.name, false, props);
    lane.xAxisAnnotation();

    // A group element to hold the visualization (+annotation)
    let group = graphLayout.addDataGroup(laneLayout, data.name);
    let elements = [];

    // Appropriate color palette for the number of rows we need to distinguish
    let myPalette = palette[Math.max(Math.min(data.rows.length, palette.length - 1), 0)];

    let lineWidthHalf = 2;
    let topY = 0;
    let rowY = [];

    let hoverLine = graphLayout.getData().append("line")
        .attr("display", "none");

    let hoverText = graphLayout.getData().append("text")
        .attr("class", "highlight-closest-text")
        .attr("display", "none");

    const yForTop = topY => {
        return d => {
            return yScale(d.overlap + topY);
        };
    };
    const x1 = d => {
        if (d.start){
            let out = Math.min(props.xScale(d.start - 0.5) + lineWidthHalf + 1, props.xScale(d.start));
            return out;
        }
        return 0.5;
    };
    const x2 = d => {
        if (d.stop){
            return Math.max(props.xScale(d.stop + 0.5) - lineWidthHalf - 1, props.xScale(d.stop));    
        }
    };
    const getText = d => {
        return d.text;
    };
    const strokeWidth = d => {
        return d.group ? 6 : undefined;
    };
    const color = i => {
        if (data.rows[i].hasOwnProperty("color") && data.rows[i].color) {
            let color = data.rows[i].color;
            return function (d) {
                // If color is defined on the interval, use it
                if (d.hasOwnProperty("color") && d.color !== null) {
                    return d.color;
                }
                // Fall back to row color
                return color;
            }
        }
        return function (d) {
            // If color is defined on the interval, use it
            if (d.hasOwnProperty("color") && d.color !== null) {
                return d.color;
            }

            // Fall back to default palette
            return myPalette[i % myPalette.length];
        }
    };

    // Turn each group into horizontal lines
    for (let i = 0; i < data.rows.length; i++) {
        let row = data.rows[i];
        let seriesName = row.name;

        let seriesData = row.intervals; // { start, stop, text }

        let seriesGroup = group.append("g")
            .attr("class", data.name + "-" + seriesName);

        let y = yForTop(topY);
        let fontSize = "8px";
        if (!props.interactive){
            fontSize = "6px";
        }
        if (rowLabels !== "none") {
            // Create title for the row
            let newTextY = y({ overlap: 0 }) + laneLayout.getY() + extraTitleHeight + graphLayout.getMargin().top - 5;
    
            let newText = graphLayout.getEntire().append("text")
                .attr("x", graphLayout.getMargin().left - props.leftColumnBorder - 2)
                .attr("y", newTextY)
                .attr("width", graphLayout.getMargin().left - props.leftColumnBorder)
                .attr("height", 2)
                .attr("class", "line-title")
                .attr("style", `font-size: ${fontSize}`)
                .text(row.name);

            if (titleCallback){
                let newY = y({ overlap: 0 }) + graphLayout.getMargin().top + laneLayout.getY() - 5 + extraTitleHeight
                newText.attr("y", newY);
                
                let buttonContainer = graphLayout.getEntire().append("svg")
                    .attr("class", "msa-title")
                    .attr("x", 0)
                    .attr("y", newY)
                    .attr("height", 14)
                    .attr("width", graphLayout.getMargin().left - props.leftColumnBorder)

                let linkId = row.name.split(" ")[0];
                let clickFunc = dir => {
                    titleCallback(linkId, dir);
                }
            }

            //Add spinners if this resource takes extra time to load
            //These are removed when the resource completes (loading set to false, Row re-added)
            if (row.loading) {
                graphLayout.getEntire().append('foreignObject')
                    .attr("class", `track-spinner`)
                    .attr("x", graphLayout.getMargin().left)
                    .attr("y", y({ overlap: 0 }) + laneLayout.getY() + graphLayout.getMargin().top - 10)
                    .attr("height", 20)
                    .attr("width", 20)
                    .style("fill", "rgba(0,0,0,0.2)")
                    .append("xhtml:div")
                    .attr("height", 20)
                    .attr("width", 20)
                    .attr("class", "spinner")
                    .style("visibility", "visible")
                    .style("height", "20px")
                    .style("width", "20px")
            }

            if (rowLabels == "color") {
                newText.attr("fill",
                    row.hasOwnProperty("color") && row.color !== undefined ? 
                        row.color : 
                        myPalette[i % myPalette.length]);
            }
        }
        rowY[i] = yScale(0 + topY); // Store where the row starts when zero overlap

        elements.push(seriesGroup
            .selectAll("line")
            .data(seriesData)
            .enter()
            .append("line")
            .attr("x1", x1)
            .attr("y1", y)
            .attr("x2", x2)
            .attr("y2", y)
            .attr("stroke", color(i))
            .attr("stroke-width", strokeWidth)
            .attr("xlink:href", function (d) {
                return d.url;
            })
            .attr("title", getText));

        topY += row.maximumOverlap + spaceBetweenRows;
    }

    // On update, recalculate start and end coordinates by re-setting their function
    const update = () => {
        for (let i = 0; i < elements.length; i++) {
            elements[i]
                .attr("x1", x1)
                .attr("x2", x2);
        }
    }
    const appendDetails = (element, aminoAcid, variant = false) => {
        let wasHeader = false;
        for (let i = 0; i < data.rows.length; i++) {
            let row = data.rows[i];
            let seriesData = row.intervals; // { start, stop, text, url }
            for (let j = 0; j < seriesData.length; j++) {
                let interval = seriesData[j];
                if (interval.start <= aminoAcid && aminoAcid <= interval.stop) {
                    if (!wasHeader) {
                        let title = data.title;
                        element.append("<h4>" + title + "</h4>");
                        wasHeader = true;
                    }
                    if (variant && !interval.text.toUpperCase().replace(" ", "").includes(`${variant.ref}${variant.pos}${variant.alt}`.toUpperCase())){
                        continue;
                    }
                    element.append("<a href='" + interval.url + "'>" + interval.text + "</a><br/>");
                }
            }
        }
    }
    const click = () => {
        if (closest) {
            if (closest.aaMatch && closest.distance < 5) {
                if (closest.interval.hasOwnProperty("url") && closest.interval.url !== null) {
                    window.open(closest.interval.url, "_blank");
                    return true;
                }
            }
        }
        return false;
    }

    const hover = (aminoAcid, mouseY) => {
        // Find closest element
        closest = {
            minRow: -1,
            minInterval: -1,
            distance: 1000000, // Distance in Y axis
            start: -1,
            stop: -1,
            y: -1,
            aaDistance: 1000000, // Distance from amino acid
            aaMatch: false // True if the closest item matches the amino acid we are highlighting
        };
        for (let i = 0; i < data.rows.length; i++) {
            let row = data.rows[i];
            let y = rowY[i] + laneLayout.getY() + extraTitleHeight;
            let seriesData = row.intervals; // { start, stop, text, url }

            for (let j = 0; j < seriesData.length; j++) {
                let interval = seriesData[j];
                let aaMatch = interval.start <= aminoAcid && aminoAcid <= interval.stop;
                if (closest.aaMatch && !aaMatch) {
                    continue; // We already have interval that matches AA, but the new one doesn't
                }
                let yInterval = y + yScale(interval.overlap);

                let distance = Math.abs(mouseY - yInterval);
                let aaDistance = aaMatch ?
                    0 :
                    Math.min(Math.abs(aminoAcid - interval.start), Math.abs(aminoAcid - interval.stop));

                let betterMatch = (aaMatch && !closest.aaMatch) ||
                    (aaDistance < closest.aaDistance) ||
                    ((aaDistance == closest.aaDistance) && (distance < closest.distance));
                if (betterMatch) {
                    closest.distance = distance;
                    closest.minRow = i;
                    closest.minInterval = j;
                    closest.interval = interval;
                    closest.y = yInterval;
                    closest.aaMatch = aaMatch;
                    closest.aaDistance = aaDistance;
                }
            }
        }

        if (closest.minRow != -1) {
            let lineWidthHalf = 2;
            // Found a closest entry
            // Highlight it!
            let closestRow = data.rows[closest.minRow];

            let color;

            if (closestRow.color){
                color = closestRow.color;
            } else if (closestRow.intervals && closestRow.intervals.length && closestRow.intervals[0].color){
                color = closestRow.intervals[0].color;
            } else {
                color = myPalette[closest.minRow % myPalette.length];
            }

            hoverLine
                .attr("x1",
                    Math.min(props.xScale(closest.interval.start),
                        props.xScale(closest.interval.start - 0.5) + lineWidthHalf + 1))
                .attr("x2",
                    Math.max(props.xScale(closest.interval.stop),
                        props.xScale(closest.interval.stop + 0.5) - lineWidthHalf - 1))
                .attr("y1", closest.y)
                .attr("y2", closest.y)
                .attr("stroke", color)
                .attr("class", "highlight-closest-line")
                .attr("display", null);

            let xText = props.xScale(closest.interval.stop + 0.5) + 3; // Right end of the line
            if (closest.aaMatch &&
                (props.xScale(closest.interval.stop + 0.5) - props.xScale(closest.interval.start - 0.5)) >
                100) {
                // The interval is long and we matched the amino acid
                // The text is too far from the current position
                xText = props.xScale(aminoAcid + 0.5) + 3;
            }
            
            hoverText
                .attr("x", xText)
                .attr("y", closest.y - 3)
                .attr("fill", "black")
                .attr("display", null)
                .attr("background", "lightsteelblue")
                .attr("text-anchor", "start")
                .text(closest.interval.text);

            // Correct for sliding out of screen
            let length = hoverText[0][0].clientWidth;
            if (xText + length > props.width && xText > props.width / 2) {
                xText = props.xScale(closest.interval.start - 0.5) - 3;
                if (closest.aaMatch &&
                    (props.xScale(closest.interval.stop + 0.5) - props.xScale(closest.interval.start - 0.5)) >
                    100) {
                    // The interval is long and we matched the amino acid
                    // The text is too far from the current position
                    xText = props.xScale(aminoAcid - 0.5) + 3;
                }
                hoverText
                    .attr("x", xText)
                    .attr("text-anchor", "end");
            }
        }
    }
    const unhover = () => {
        hoverLine.attr("display", "none");
        hoverText.attr("display", "none");
    }
    return Object.assign(
        {},
        {...lane, update, appendDetails, click, hover, unhover}
    )
}
export default GenericLane;