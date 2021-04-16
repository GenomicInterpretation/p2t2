// Window display details for given AA
// element - the div to fill in
// lanes - information about lanes
const Details = (elements, lanes) => {
    // Set the hover to highlight a given amino acid
    const highlight = (aminoAcid, details = false) => {
        // Wipe it
        elements.map(element => {
            element.html("");
            for (let i = 0; i < lanes.length; i++) {
                let lane = lanes[i];
                // Ask the lane to append info about itself to the element
                if (lane.appendDetails) {
                    lane.appendDetails(element, aminoAcid, details);
                }
            }
        })
    }
    return { highlight }
};
export default Details;