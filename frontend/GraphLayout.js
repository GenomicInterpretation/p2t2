import { extraTitleHeight } from './utilities';

const GraphLayout = (entire, data, margin, dataWidth) => {
    const getEntire = () => {
        return entire;
    }
    const getMargin = () => {
        return margin;
    }
    const getData = () => {
        return data;
    }
    const getDataWidth = () => {
        return dataWidth;
    }
    // Make svg <g> element for the data portion, add annotation
    const addDataGroup = (laneLayout, name) => {
        let laneOffset = (laneLayout.getY() + extraTitleHeight);
        if (name === ""){
            laneOffset = laneLayout.getY();
        }
        return data.append("g")
            .attr("width", dataWidth)
            .attr("height", laneLayout.getHeight())
            .attr("class", "noselect " + name)
            .attr("transform", "translate(0," + laneOffset + ")");
    };
    return { addDataGroup, getEntire, getMargin, getData, getDataWidth }
}
export default GraphLayout;