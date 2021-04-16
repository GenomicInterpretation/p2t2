import Details from './details.js';
import DataModel from './data_model.js';
import P2T2Chart from './P2T2Chart.js';

import {endpointVar, getBlastURL, variantRgxs } from './utilities.js';

var pageView;
$(document).ready(function(){
    pageView = PageView();
    pageView.setupView();
});

const seqSearch = async (query, type) => {
    query = query.toUpperCase().replace(/ /g, "");
    
    let headers = { "Content-Type": "application/x-www-form-urlencoded" };
    
    let url = getBlastURL(query, type);
    if (!url){
        throw new Error("Invalid characters found in query");
    }
    let res = await fetch(url, { headers, method: "GET" });
    let geneData = await res.text();
}

const searchGeneAsync = searchTerm => {
    //Find close gene names to query
    let url = `http://rest.genenames.org/search/${searchTerm}*`;

    let promise = Promise.resolve($.getJSON(url));
    return promise.then(data => {
        if (data.response.numFound > 0){
            processQueryResults(data, true);
            return true;
        } else {
            return false;
        }
    });
}

// Functions for accessing the data
const processQueryResults = async (data, fromGeneNames = false) => {
    // Wipe the previous results
    $("#tbl_results").html("");

    let symbol_result, li_result, a_result, i;

    //If called from failed gene symbol query
    if (fromGeneNames){
        data = data.response.docs;
    }
    if (data.length > 1) {
        $("#result_header").html("Please select an approved gene symbol:");

        for (i = 0; !!(symbol_result = data[i]); i = i + 1) {
            // only show up to the first 10 results
            if (i === 10) { break; }

            a_result = document.createElement("A");
            a_result.href = "#";
            a_result.innerHTML = symbol_result.symbol;
            a_result.query = symbol_result.symbol;
            a_result.onclick = function () {
                // hide dropdown
                $(this).parent().parent().hide();
                $("#txt_gene_search").val(this.query);
                loadPanels(this.query);
                return false;
            };

            li_result = document.createElement("LI");
            li_result.appendChild(a_result);

            document.getElementById("tbl_results").appendChild(li_result);
        }

        $("#tbl_results").show();

    } else if (data.length == 1) {
        let query = data[0];
        loadPanels(query);

    } else {
        a_result = document.createElement("a");
        a_result.href = "#";
        a_result.innerHTML = "<strong>None found, please try again.</strong>";
        a_result.onclick = function () {
            // hide dropdown
            $(this).parent().parent().hide();
        };

        li_result = document.createElement("li");
        li_result.appendChild(a_result);

        document.getElementById("tbl_results").appendChild(li_result);
        $("#tbl_results").show();
    }
}
async function loadPanels(searchTerm){
    try {
        pageView.resetView();
        let headers = { "Content-Type": "application/json" };
        let body = JSON.stringify({ query: searchTerm });
        
        let res = await fetch(`${endpointVar}/load_transcript`, { headers, body, method: "POST" });
        let geneData = await res.json();
        if (res.status > 499){
            alert("Something went wrong.");

        } else if (res.status > 299){
            //If unrecognized query, try mapping to known gene symbol or sequence
            if (JSON.parse(geneData).id_type === "gene_symbol"){
                if (searchGeneAsync(searchTerm)){
                    throw new Error(`Unknown query: ${searchTerm}`);
                }
            } else {
                throw new Error(`Unknown query: ${searchTerm}`);
            }
        } else {
            geneData = JSON.parse(geneData);
            console.log(geneData)
            new DataModel(geneData, pageView.setModel);
        }
        
    } catch (err){
        console.error(err);
        alert(`Data for ${searchTerm} not found!`);
    }
}
const PageView = () => {

    const initialState = {
        dataModel: null,
        details: null,
        mainChart: null,
        aminoAcidFocus: null,
        variantInfo: null
    }

    let state = initialState;

    // Blank the view out
    const resetView = () => {
        state = initialState;
        $("#status").html("");
        $("#notes").html("");
        $("#graph").html("");
        resetDetails();
    }

    const displayAminoAcid = () => {
        let markVal = state.aminoAcidFocus;
        let variantInfo;
        $("#txt_aa_mark").val(markVal);

        state.details.highlight(state.aminoAcidFocus, variantInfo);
        state.mainChart.getHighlight().highlight(state.aminoAcidFocus);
    }
    const setupView = () => {
        $(".hasHelptip").hover(function(){
            let control = $(this).attr("helptip");
            $(`#${control}Help`).addClass("show");
        }, function(){
            let control = $(this).attr("helptip");
            $(`#${control}Help`).removeClass("show");
        });

        // Handler for search
        $("#btn_gene_search").click(function(){
            let query = $("#txt_gene_search").val();
            let idType = $("#id-type option:selected").attr("value");
            if (idType !== "id"){
                seqSearch(query, idType);
            } else {
                processQueryResults([query]);
            }
            return false;
        });

        // Handler for marking amino acid position
        $("#btn_aa_mark").click(function(){
            // Get the mark value
            let value = $("#txt_aa_mark").val().toUpperCase();
            if (Array.isArray(value.match(variantRgxs.full))){
                let ref = value.match(variantRgxs.ref)[1];
                let pos = +value.match(variantRgxs.pos)[1];
                let alt = value.match(variantRgxs.alt)[1];
                state.aminoAcidFocus = pos;
                let variantInfo = {ref, pos, alt}

                setAAFocus(pos);
                setVariantInfo(variantInfo);
                displayAminoAcid();
            } else if (!isNaN(+value)){
                setAAFocus(+value);
                setVariantInfo(null);
                displayAminoAcid();
            }
        });

        // Handlers that reset view if user changes seq type / ann type
        $("#msa_seq_type").change(function(){
            $("#warnings").hide();
            state.dataModel.setAlignments($("#msa_seq_type").val());
            
            state.dataModel.loadGeneAsync().map(asyncComplete => {
                return asyncComplete.then(() => state.mainChart.generateAnnotationPanels());
            });
            state.details = Details([$("#details")], state.mainChart.getLanes());
        });

        $("#msa_ann_type").change(resetView);

        $(".dialog-close").click(function(){
            $(".custom-dialog").hide();
        })
        // Async loading spinner
        let $loading = $('.spinner');
        $(document)
            .ajaxStart(function(){
                $loading.css("visibility", "visible");
            })
            .ajaxStop(function(){
                $loading.css("visibility", "hidden");
            });
    }
    const resetDetails = () => {
        $("#details").html(""); // Remove details view
    }
    const setAAFocus = aa => {
        state.aminoAcidFocus = aa;
    }
    const setVariantInfo = info => {
        state.variantInfo = info;
    }
    const setModel = (dataModel, props) => {
        $("#txt_aa_mark").val(""); // Reset the mark
        resetDetails();
        state.dataModel = dataModel;

         // Set status
         let titleHtml = `Gene Symbol: ${dataModel.ensemblGeneSymbol}. Isoform: ${dataModel.uniprotId}. Transcript: ${dataModel.enst}`;
         $("#status").html(titleHtml);

        // Set the note
        if (dataModel.warning) {
            $("#warnings").html("<b>Warning:</b> " + dataModel.warning).show();
        }
        else {
            $("#warnings").hide();
        }
        $("#notes").html("<b>Note:</b> " + dataModel.note).show();

        let chartProps = {
            displayAminoAcid: displayAminoAcid,
            setVariantInfo: setVariantInfo,
            setAAFocus: setAAFocus,
            interactive: true,
            trackOrder: [
                "seq", "gnomad", "siteSpecificAnnotations", "ipsMotifcs", "elmMotifs", "pdbHomology", "alignments"
            ],
            containerID: "graph-container",
            pageMargin: {
                left: 0, right: 0, top: 0, bottom: 0
            },
        }

        state.mainChart = P2T2Chart(dataModel, "graph", chartProps);
        state.mainChart.init();
        state.mainChart.generateAnnotationPanels();


        state.details = Details([$("#details")], state.mainChart.getLanes());

        if (props.variantInfo){
            //If user searched for a specific variant, try to highlight and detail it
            setAAFocus(props.variantInfo.pos);
            setVariantInfo(props.variantInfo);
            displayAminoAcid();
            state.mainChart.brushEnded([props.variantInfo.pos - 1, parseInt(props.variantInfo.pos, 10) + 1])
        }
    }
    return {
        setupView, resetView, setModel
    }
}
export default PageView;