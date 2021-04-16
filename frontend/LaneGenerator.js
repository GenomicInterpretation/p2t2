import ProteinSequenceLane from './ProteinSequenceLane.js';
import GnomadLane from './GnomadLane.js';
import GenericLane from './GenericLane.js';
import AlignmentLane from './AlignmentLane.js';
import './js/jquery-ui-1.12.1/jquery-ui.min.js';

const LaneGenerator = (dataModel, graphID, props) => {
    const laneCurry = partial => {
        return (graphLayout, laneLayout) => {
            return partial.func(graphLayout, laneLayout, ...partial.boundArgs, {
                ...state.laneProps, 
                xScale: state.xScale, 
                xAxis: state.xAxis, 
                width: state.width, 
                margin: state.margin
            })
        }
    }

    const laneMap = {
        "seq": laneCurry({ func: ProteinSequenceLane, boundArgs: [dataModel.seq, dataModel.exons]}),
        "gnomad": laneCurry({ func: GnomadLane, boundArgs: [dataModel.gnomad]}),
        "alignments": laneCurry({ func: AlignmentLane, boundArgs: [dataModel.alignments, dataModel.uniprotId]}),
        "siteSpecificAnnotations": laneCurry({ func: GenericLane, boundArgs: [dataModel.siteSpecificAnnotations, "color"]}),
        "ipsMotifs": laneCurry({ func: GenericLane, boundArgs: [dataModel.ipsMotifs, "color"]}),
        "elmMotifs": laneCurry({ func: GenericLane, boundArgs: [dataModel.elmMotifs, "none"]}),
        "pdbHomology": laneCurry({ func: GenericLane, boundArgs: [dataModel.pdbHomology, "black"]}),
    }
    const getLane = lane =>  laneMap[lane](graphLayout, laneLayout)
    
    return { getLane}
}