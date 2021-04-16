import { showLane, hideLane, isLaneHidden } from './laneHiding.js';
import { extraTitleHeight } from './utilities';

const Lane = (graphLayout, laneLayout, title, name, customHighlight, props) => {
    const titleWithSymbol = () => {
        return props.interactive ? title + (isLaneHidden(name) ? " ▸" : " ▾") : title;
    }
    const symbolWithoutTitle = () => {
        return isLaneHidden(name) ? " ▸" : " ▾";
    }
    const toggleLaneHidden = () => {
        if (isLaneHidden(name)) {
            showLane(name);
        } else {
            hideLane(name);
        }
        props.relayout();
    }
    const xAxisAnnotation = () => {
        graphLayout.getEntire().append("rect")
            .attr("x", props.pageMargin.left || 0)
            .attr("y", graphLayout.getMargin().top + laneLayout.getY())
            .attr("width", graphLayout.getMargin().left - props.leftColumnBorder - (props.pageMargin.left || 0))
            .attr("height", laneLayout.getHeight() + 15)
            .attr("fill", "rgb(230, 230, 230)")
            .attr("class", "rowGroupRect");

        let rowTitle = graphLayout.getEntire().append("svg")
            .attr("x", 5 + (props.pageMargin.left || 0))
            .attr("y", graphLayout.getMargin().top + laneLayout.getY() - 25)
            
        let titleMarginLeft = 0;
        if (props.interactive){
            titleMarginLeft = 21;
        }
        let titleText = rowTitle.append("text")
                .text(title)
                .attr("x", titleMarginLeft)
                .attr("y", 10 + extraTitleHeight)
                .attr("class", "rowGroupLabel")
                .style("font-size", 10)
                .on("click", function(i, e){
                    if (props.laneTitleLink){
                        window.open(props.laneTitleLink);
                    }
                })
                
        if (props.interactive){
            
            rowTitle.append("text")
                .attr("x", titleMarginLeft + 5 + titleText.node().getComputedTextLength())
                .attr("y", 10 + extraTitleHeight)
                .attr("class", "rowGroupLabelSymbol")
                .text(symbolWithoutTitle())
                .on("click", function (d, i) {
                    toggleLaneHidden();
                    d3.select(this).text(symbolWithoutTitle());
                })
                .on("mouseover", function(d, i){
                    d3.select(this).style("cursor", "pointer");
                })
                .on("mouseout", function(d, i){
                    d3.select(this).style("cursor", "default");
                });
        }
    }
    const getLayout = () => {
        return laneLayout;
    }
    const getName = () => {
        return name;
    }
    const getCustomHighlight = () => {
        return customHighlight;
    }

    return {
        titleWithSymbol, toggleLaneHidden, xAxisAnnotation, getLayout, getName, getCustomHighlight
    }
}
export default Lane;