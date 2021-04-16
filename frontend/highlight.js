import { extraTitleHeight } from './utilities';

// A highlight bar to mark a particular amino acid position
// Basically just like hover bar
const Highlight = (graphLayout, props) => {
  $("#highlightBar").remove();

  let highlighting = false;
  let highlightedAA = -1;


  // How to display the highlighted AA
  let highlightBar = graphLayout.getEntire().insert("g", ":first-child")
    .attr("id", "highlightBar")
    .attr("transform", "translate(0,0) scale(1, 1)")
    .attr("height", props.height)
    .attr("width", 1)
    .attr("class", "highlight-bar")
    .attr("display", "none");

  for (let i = 0; i < props.lanes.length; i++) {
    let lane = props.lanes[i];
    if (lane.highlight) {
      // We do not want a highligher for custom sequences (we already do that work)
      continue;
    }

    highlightBar.append("rect")
      .attr("x", 0)
      .attr("y", lane.getLayout().getY())
      .attr("width", 1)
      .attr("height", lane.getLayout().getHeight());
  }

  const highlight = aminoAcid => {
    highlightedAA = aminoAcid;
    if (aminoAcid >= props.xScale.domain()[0] && aminoAcid <= props.xScale.domain()[1]) {
      let x = props.xScale(aminoAcid - 0.5) + graphLayout.getMargin().left;
      let y = graphLayout.getMargin().top;
      let width = props.xScale(2) - props.xScale(1);

      highlightBar.attr("transform", `translate(${x},${y}) scale(${width},1)`);

      for (let i = 0; i < props.lanes.length; i++) {
        let lane = props.lanes[i];
        if (lane.highlight) {
          lane.highlight(aminoAcid);
        }
      }
      show();
    }
    else {
      hide();
    }
  }
  const show = () => {
    if (!highlighting) {
      highlighting = true;
      if (highlightedAA > 0) {
        highlightBar.attr('display', null);
      } else {
        highlightBar.attr('display', 'none');
      }
    }
  }
  const hide = () => {    
    if (highlighting) {
      highlighting = false;
      highlightBar.attr('display', 'none');
      for (let i = 0; i < props.lanes.length; i++) {
        let lane = props.lanes[i];
        if (lane.unhighlight) {
          lane.unhighlight();
        }
      }
    }
  }
  const disable = () => {
    highlightBar.attr('display', 'none');
  }
  const enable = () => {
    highlight(highlightedAA);
  }
  return{
    highlight, show, hide, disable, enable
  }
};
export default Highlight;