import GraphLayout from './GraphLayout.js';
import LaneLayout from './LaneLayout.js';
import ProteinSequenceLane from './ProteinSequenceLane.js';
import GnomadLane from './GnomadLane.js';
import GenericLane from './GenericLane.js';
import AlignmentLane from './AlignmentLane.js';
import Hover from './hover.js';
import Highlight from './highlight.js';

import { isLaneHidden } from './laneHiding.js';
import { getLaneHeight, debounce, ySpace } from './utilities.js';

import './js/jquery-ui-1.12.1/jquery-ui.min.js';

const P2T2Chart = (dataModel, graphID, props) => {
    const initialState = {
        xScale: null,
        xAxis: null,
        // List of the "lanes" in the chart, representing different data sets
        // Each lane has - name, title, svg group it belongs to, transform that goes from the coord space to screen space,
        // list of graphical elements in it, yScale and yAxis
        lanes: [],
        laneProps: {},
        graph: d3.select(`#${graphID}`),
        svg: null,
        margin: { top: 20, right: 10, bottom: 0, left: 160 },
        leftColumnBorder: 5,
        width: props.width || 1000,
        height: 1000,
        hover: null, // Green hover bar
        highlight: null, // Yellow current highlight bar
        brush: null, // Brush to zoom
        brushElement: null, // The element displaying the brush,
        mark: null,
        loaded: false
    }
    let state = initialState;

    const getHighlight = () => {
        return state.highlight;
    }
    const getMark = () => {
        return state.mark;
    }
    if (props.interactive){
        $(`#${graphID}`).click(function(e) {
            if (e.shiftKey) {
                // When user shift-clicks, set the mark and display details
                let aminoAcid = state.hover.getHighlightedAA();
                if (aminoAcid >= state.xScale.domain()[0] && aminoAcid <= state.xScale.domain()[1]) {
                    state.mark = aminoAcid;
                    props.setAAFocus(aminoAcid);
                    props.setVariantInfo(null);
                    props.displayAminoAcid();
                }
            }
        });
    }

    const brushEnded = extent => {
        if (state.loaded) {
            if (!extent){
                extent = state.brush.extent();
            }
            
            
            if (extent[0] != extent[1]) {
                state.xScale.domain([
                    Math.max(1, Math.floor(extent[0] + 0.5)) - 0.5,
                    Math.min(Math.ceil(extent[1] - 0.5), dataModel.numAA) + 0.5
                ]);
            }
            clearBrush();
            updateView();
            if (state.hover) {
                state.hover.enable();
            }
            if (state.highlight) {
                state.highlight.enable();
            }
        }
    }
    const clearBrush = () => {
        if (state.loaded && props.interactive) {
            d3.select(".brush").call(state.brush.clear());
        }
    }
    const resize = () => {
        state.width = 
            props.width - state.margin.left - state.margin.right || 
            $(`#${props.containerID}`).width() - state.margin.left - state.margin.right;

        state.height = state.laneProps.yPos || 0;
        state.xScale = state.xScale.range([0, state.width]);
        
        state.graph
            .attr("width", state.width + state.margin.left + state.margin.right)
            .attr("height", state.height + state.margin.top + state.margin.bottom);

        $(`#${graphID}-dataClip rect`)
            .attr("width", state.width + state.margin.left + state.margin.right)
            .attr("height", state.height);

        updateView();
        clearBrush();
    }
    const updateView = () => {
        if (state.loaded) {
            let lanes = state.lanes;
            for (let i = 0; i < lanes.length; i++) {
                let lane = lanes[i];
                lane.update();
            }
            
            state.xAxis.tickValues(state.xScale.ticks(5).concat([
                Math.floor(state.xScale.domain()[0] + 0.5),
                state.xScale.domain()[1] - 0.5
            ]));
            state.graph.select(".x.axis").call(state.xAxis);
            if (props.updateCallback){
                props.updateCallback(state.xScale.domain());
            }
        }
    }
    const resetZoom = () => {
        if (state.loaded) {
            state.xScale.domain([1, dataModel.numAA]);
            updateView();
            if (props.interactive){
                state.hover.enable();
                state.highlight.enable();
            }
        }
    }
    const makeLane = (track, graphLayout) => {
        state.laneProps.laneTitleLink = null;
        let lane, layout;
        if (track === "seq"){
            layout = LaneLayout(
                state.laneProps.yPos, 
                getLaneHeight(dataModel, "seq"));
            lane = ProteinSequenceLane(
                graphLayout,
                layout,
                dataModel.seq,
                dataModel.exons,
                state.laneProps
            )

        } else if (track === "gnomad"){
            state.laneProps.laneTitleLink = "https://gnomad.broadinstitute.org/about";
            if (dataModel.gnomad != null) {
                layout = LaneLayout(
                    state.laneProps.yPos, 
                    getLaneHeight(dataModel, 'gnomad'), 
                    isLaneHidden('gnomad'));
                lane = GnomadLane(
                    graphLayout, 
                    layout,
                    dataModel.gnomad, 
                    state.laneProps
                );
            }
        } else if (track === "siteSpecificAnnotations"){
            if (dataModel.siteSpecificAnnotations != null) {
                layout = LaneLayout(
                    state.laneProps.yPos,
                    getLaneHeight(dataModel, "siteSpecificAnnotations"),
                    isLaneHidden(dataModel.siteSpecificAnnotations.name));
    
                lane = GenericLane(
                    graphLayout,
                    layout,
                    dataModel.siteSpecificAnnotations,
                    "color",
                    state.laneProps
                );
            }
        } else if (track === "ipsMotifs"){
    
            if (dataModel.ipsMotifs != null) {
                layout = LaneLayout(
                    state.laneProps.yPos,
                    getLaneHeight(dataModel, "ipsMotifs"),
                    isLaneHidden(dataModel.ipsMotifs.name));
                lane = GenericLane(
                    graphLayout,
                    layout,
                    dataModel.ipsMotifs,
                    "color",
                    state.laneProps
                );
            }
        } else if (track === "elmMotifs"){
            if (dataModel.elmMotifs != null) {
                layout = LaneLayout(
                    state.laneProps.yPos,
                    getLaneHeight(dataModel, "elmMotifs"),
                    isLaneHidden(dataModel.elmMotifs.name));
                lane = GenericLane(
                    graphLayout,
                    layout,
                    dataModel.elmMotifs,
                    "none",
                    state.laneProps
                );
            }
        } else if (track === "pdbHomology"){
    
            if (dataModel.pdbHomology != null) {
                layout = LaneLayout(
                    state.laneProps.yPos,
                    getLaneHeight(dataModel, "pdbHomology"),
                    isLaneHidden(dataModel.pdbHomology.name));

                lane = GenericLane(
                                graphLayout,
                                layout,
                                dataModel.pdbHomology,
                                "black", 
                                state.laneProps,
                            )
            }
        } else if (track === "alignments"){
            if (dataModel.alignments != null) {
                layout = LaneLayout(
                    state.laneProps.yPos,
                    getLaneHeight(dataModel, "alignments"),
                    isLaneHidden("alignments")
                );
                lane = AlignmentLane(
                    graphLayout,
                    layout,
                    dataModel,
                    state.laneProps
                );
            }
        }
        if (lane){
            state.lanes.push(lane);
            state.laneProps.yPos = state.laneProps.yPos + layout.getHeight() + (props.ySpace || ySpace);
        }
    }
    const generateAnnotationPanels = () => {
        state.loaded = true;
        state.xScale = state.xScale.domain([1, dataModel.numAA]);
        state.lanes = [];
        state.height = 1000;
        state.laneProps.yPos = props.startPos || 0;

        let margin = state.margin;
       
        // Wipe the visualization
        $(`#${graphID}`).html("");

        state.graph.append("defs").append("clipPath").attr("id", `${graphID}-dataClip`).append("rect")
            .attr("width", state.width)
            .attr("height", state.height);

        // The area for drawing the plots themselves (sans margins)
        state.svg = state.graph.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
            .attr("clip-path", `url(#${graphID}-dataClip)`);

        // Create X axis --------------------------------
        state.graph.append("g")
            .attr("class", "x axis noselect")
            .attr("transform", "translate(" + margin.left + "," + (margin.top + (props.startPos || 0 )) + ")")
            .call(state.xAxis);

        if (props.interactive){
            // Create brush --------------------------------
            state.brush = d3.svg.brush()
                .x(state.xScale)
                .extent([1, dataModel.numAA])
                .on("brushend", brushEnded);

            state.brushElement = state.svg.append("g")
                .attr("class", "brush")
                .call(state.brush)
                .call(state.brush.event);
        }

        // Start creating the lanes/rows in the graph --------------------------------
        let graphLayout = GraphLayout(state.graph, state.svg, state.margin, state.width);

        // Start creating graphs
        for (let i = 0; i < props.trackOrder.length; i ++){
            makeLane(props.trackOrder[i], graphLayout);
        }

        // Set plot height
        let finalLaneLayout = state.lanes[state.lanes.length - 1].getLayout();
        state.height = finalLaneLayout.getY() + finalLaneLayout.getHeight() + (props.ySpace || ySpace);
        if (props.interactive){
             // Brush all except the alignment lane
            let lastBrushableLaneIndex = state.lanes.length - 1;
            if (state.lanes[lastBrushableLaneIndex].name === "alignments") {
                lastBrushableLaneIndex--;
            }
            
            let lastBrushableLane = state.lanes[lastBrushableLaneIndex];
            state.brushElement.selectAll("rect")
                .attr("height", lastBrushableLane.getLayout().getY() + lastBrushableLane.getLayout().getHeight());

            state.hover = Hover(graphLayout, 
                {lanes: state.lanes, 
                    graph: state.graph, 
                    xScale: state.xScale, 
                    width: state.width            });
            
            state.highlight = Highlight(graphLayout, 
                {lanes: state.lanes, 
                    graph: state.graph, 
                    height: state.height, 
                    xScale: state.xScale
                });
            state.highlight.disable();
        }

        resize();
        resetZoom();
    }
    const getLaneProps = () => {
        return state.laneProps;
    }
    const setLaneProps = (k, v) => {
        state.laneProps[k] = v;
    }
    const getLanes = () => {
        return state.lanes;
    }
    const init = () => {
        state.xScale = d3.scale.linear();
        state.xAxis = d3.svg.axis().scale(state.xScale).tickSize(5).orient("top");
        state.graph = d3.select(`#${graphID}`);

        let width = state.width + state.margin.left + state.margin.right;
        state.graph
            .attr("width", width)
            .attr("height", state.height + state.margin.top + state.margin.bottom);
    
        // Reset zoom handler
        $(`#${graphID}`).dblclick(resetZoom);
    
        d3.select(window).on('resize', debounce(resize, 100));
        resize();
        state.laneProps = {
            uniprotId: dataModel.uniprotId, 
            leftColumnBorder: state.leftColumnBorder, 
            width: state.width,
            xScale: state.xScale,
            yPos: props.startPos || 0,
            relayout: generateAnnotationPanels,
            alignmentButtonCB: props.alignmentButtonCB,
            laneTitleCB: props.laneTitleCB,
            interactive: props.interactive,
            pageMargin: {
                left: props.pageMargin.left,
                right: props.pageMargin.right,
                top: props.pageMargin.top,
                bottom: props.pageMargin.bottom,
            }
        };
    }
    const getHover = () => {
        return state.hover;
    }
    const getWidth = () => state.width;
    return { getWidth, brushEnded, setLaneProps, getLaneProps, generateAnnotationPanels, getLanes, 
        init, getMark, getHighlight, resize, getHover}
}
export default P2T2Chart;