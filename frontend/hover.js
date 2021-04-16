// A hover bar to let user read out information for particular AA
// Sets the hover to highlight a given amino acid
const Hover = (graphLayout, props) => {
    let highlighting = false;
    let highlightedAA = -1;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let margin = graphLayout.getMargin();

    $("#hoverBar").remove();

    // How to display the hovered AA
    let hoverBar = graphLayout.getEntire().append("g")
        .attr("id", "hoverBar")
        .attr("transform", "translate(0,0) scale(1, 1)")
        .attr("height", props.height)
        .attr("width", 1)
        .attr("class", "hover-bar")
        .attr("display", "none");

    for (let i = 0; i < props.lanes.length; i++) {
        let lane = props.lanes[i];
        if (lane.getCustomHighlight()) {
            // We do not want a highligher for custom sequences (we already do that work)
            continue;
        }
        
        hoverBar.append("rect")
            .attr("x", 0)
            .attr("y", lane.getLayout().getY())
            .attr("width", 1)
            .attr("height", lane.getLayout().getHeight());
    }

    let lastBrushableLaneIndex = props.lanes.length - 1;
    if (props.lanes[lastBrushableLaneIndex].getName() === "alignments") {
        lastBrushableLaneIndex--;
    }
    
    let lastBrushableLane = props.lanes[lastBrushableLaneIndex];
    
    // A rectangle capturing highlighting events
    let eventRect = props.graph.append("rect")
        .attr("class", "overlay")
        .attr("x", margin.left)
        .attr("width", props.width + margin.right)
        .attr("height", lastBrushableLane.getLayout().getY() + lastBrushableLane.getLayout().getHeight() + margin.top)
        .on("mousedown", function () {
            // First check whether we are over something clickable
            for (let i = 0; i < props.lanes.length; i++) {
                let lane = props.lanes[i];
                if (lane.click) {
                    // This will handle the click event properly and return true to terminate
                    if (lane.click(highlightedAA, lastMouseY)) {
                        return;
                    }
                }
            }

            // This is very tricky. Since the brush is under the "eventRect" layer that gathers mouse
            // events, we need to first disable the hover bar, THEN fake a mousedown event
            // and pass it over to the brush to process.

            // The brush is instructed to call .enable() again on brushend.
            // This way these two kinds of interaction alternate between each other
            disable();
            let brush_elm = props.graph.select(".brush").node();
            let new_click_event = new Event('mousedown');
            new_click_event.pageX = d3.event.pageX;
            new_click_event.clientX = d3.event.clientX;
            new_click_event.pageY = d3.event.pageY;
            new_click_event.clientY = d3.event.clientY;
            brush_elm.dispatchEvent(new_click_event);
        })
        .on("mouseover", function () {
            show();
        })
        .on("mouseout", function () {
            hide();
        })
        .on("mousemove", function () {
            let x = d3.mouse(this)[0] - margin.left;
            let y = d3.mouse(this)[1] - margin.top;
            highlight(x, y);
        });

    const highlight = (mouseX, mouseY) => {
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        let aminoAcid = Math.round(props.xScale.invert(mouseX));
        if (aminoAcid >= props.xScale.domain()[0] && aminoAcid <= props.xScale.domain()[1]) {
            show();

            highlightedAA = aminoAcid;
            let x = props.xScale(aminoAcid - 0.5) + margin.left;
            let y = margin.top;
            let barWidth = props.xScale(2) - props.xScale(1);
            hoverBar.attr("transform", `translate(${x},${y}) scale(${barWidth},1)`);

            for (let i = 0; i < props.lanes.length; i++) {
                let lane = props.lanes[i];
                if (lane.hover) {
                    lane.hover(aminoAcid, mouseY);
                }
            }
        } else {
            hide();
        }
        lastMouseY = mouseY;
    }
    const show = () => {
        if (!highlighting) {
            highlighting = true;
            hoverBar.attr('display', null);
            for (let i = 0; i < props.lanes.length; i++) {
                let lane = props.lanes[i];
                if (lane.hover) {
                    lane.hover(highlightedAA, lastMouseY);
                }
            }
        }
    }
    const hide = () => {
        if (highlighting) {
            highlighting = false;
            hoverBar.attr('display', 'none');
            for (let i = 0; i < props.lanes.length; i++) {
                let lane = props.lanes[i];
                if (lane.unhover) {
                    lane.unhover();
                }
            }
        }
    }
    const disable = () => {
        eventRect.attr('display', 'none');
        highlightedAA = -1;
    }
    const enable = () => {
        eventRect.attr('display', 'null');
        highlight(lastMouseX, lastMouseY);
    }
    const getHighlightedAA = () => {
        return highlightedAA;
    }
    return {highlight, show, hide, disable, enable, getHighlightedAA}
};
export default Hover;