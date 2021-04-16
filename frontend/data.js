let endpointVar = "http://p2t2.hmgc.mcw.edu/api";
if (location.hostname === 'localhost') {
    endpointVar = "http://localhost:5000/api";
}

// Functions for accessing the data
let processGeneResults = async function (data) {
    // Wipe the previous results
    $("#tbl_results").html("");

    let symbol_result, li_result, a_result, i;

    if (data.length > 1) {
        $("#result_header").html("Please select an approved gene symbol:");

        for (i = 0; !!(symbol_result = data.response.docs[i]); i = i + 1) {
            // only show up to the first 10 results
            if (i === 10) { break; }

            a_result = document.createElement("A");
            a_result.href = "#";
            a_result.innerHTML = symbol_result.symbol;
            a_result.query = symbol_result.symbol;
            a_result.onclick = function () {
                // hide dropdown
                $(this).parent().parent().hide();
                loadPanels(this.query);
                return false;
            };

            li_result = document.createElement("LI");
            li_result.appendChild(a_result);

            document.getElementById("tbl_results").appendChild(li_result);
        }

        $("#tbl_results").show();
    }
    else if (data.length == 1) {
        let query = data[0];
        loadPanels(query);
    }
    else {
        a_result = document.createElement("A");
        a_result.href = "#";
        a_result.innerHTML = "<strong>None found, please try again.</strong>";
        a_result.onclick = function () {
            // hide dropdown
            $(this).parent().parent().hide();
        };

        li_result = document.createElement("LI");
        li_result.appendChild(a_result);

        document.getElementById("tbl_results").appendChild(li_result);
        $("#tbl_results").show();
    }
}
async function loadPanels(searchTerm){
    try {
        let headers = { "Content-Type": "application/json" };
        let body = JSON.stringify({ query: searchTerm });
        
        let res = await fetch(`${endpointVar}/load_gene`, { headers, body, method: "POST" });
        let geneData = await res.json();
        geneData = JSON.parse(geneData);

        dataModel = new DataModel(geneData);
        numAA = dataModel.numAminoAcids;
        xScale = xScale.domain([1, numAA]);
        loadGeneAsync(dataModel).map(asyncComplete => {
            return asyncComplete
                .then(() => generateAnnotationPanels(dataModel))
                .catch(() => generateAnnotationPanels(dataModel))
        });
        resetZoom();
        resetDetails();
        
    } catch (err){
        console.log(err)
        alert(`Data for ${searchTerm} not found!`);
    }
}
// Returns a promise containing the JSON information about a given gene
// enriched by the FASTA sequence (if available)
function loadGeneAsync(model) {

    let withDoCM = async function(model, res, rej) {
		docmData = [];
		
        let url = "http://www.docm.info/api/v1/variants.json?genes=" + model.ensemblGeneSymbol;
        let docm = await fetch(url, {"Content-Type": "application/json"});
        try {

            if (!model.canonicalIsoform){
                throw new Error("Not canonical")
            }
            docm = await docm.json();
            let d, i;
            for (i = 0; i < docm.length; i++) {
                d = docm[i];
                let re1 = /^(p.)/;
                let re2 = /([A-Z]+)(\d+)([A-Z]+)/;
                let mut = d.amino_acid.replace(re1, '');
                let new_data = { mut: mut,
                                    ref: mut.replace(re2, '$1'),
                                    pos: mut.replace(re2, '$2'),
                                        alt: mut.replace(re2, '$3'),
                                        disease: mut + ' in: ' + d.diseases.join([separator = ', ']),
                                        pmid: d.pubmed_sources.join([separator = ','])
                };
                docmData.push(new_data);
            }
            model.addSeries("DoCM", docmData);
            res();
        } catch(err) {
            console.log("No DoCM data available!");
            rej();
        }
    }

    return [new Promise((res, rej) => { withDoCM(model, res, rej) })];
}