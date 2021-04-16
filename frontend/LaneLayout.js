import { extraTitleHeight } from './utilities';

// Represents a layout of a single "lane"
//
// y - where does the lane start (top edge)
// height - how high the lane is (when hidden, the height is truncated)
// hidden - if true, the lane is collapsed
const LaneLayout = (yPos, incHeight, hide) => {
    let y = yPos;
    let height = hide ? 10 : incHeight;
    let hidden = hide;
    const range = () => {
        return [height, 0];
    };
    const reverseRange = () => {
        return [0, height];
    };
    const getY = (addHeight = true) => {
        if (addHeight){
            return y +  + extraTitleHeight;
        }
        return y;
    }
    const getHeight = () => {
        return height;
    }
    const getHidden = () => {
        return hidden;
    }
    return { range, reverseRange, getY, getHeight, getHidden}
}
export default LaneLayout;