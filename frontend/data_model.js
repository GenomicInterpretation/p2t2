import { colors, ipsColors } from './utilities.js';

Array.prototype.getUnique = function () {
    let u = {}, a = [];
    for (let i = 0, l = this.length; i < l; ++i) {
        if (u.hasOwnProperty(this[i])) {
            continue;
        }
        a.push(this[i]);
        u[this[i]] = 1;
    }
    return a;
};

export default class DataModel {
    constructor(model, modelDone){
        this.canonicalIsoform = model.canonical_isoform;
        this.seq = model.seq;
        this.geneSymbol = model.gene_symbol;
        this.ensemblGeneSymbol = model.ensembl_gene_symbol;
        this.enst = model.enst;
        this.uniprotId = model.uniprot_id;
        this.numAA = +model.numAA;

        this.siteSpecificProps = this.getSiteSpecificProps();
        this.exons = this.getExonAnnotations(model);
        this.gnomad = this.getGnomadData(model);
        this.siteSpecificAnnotations = new RowGroup("siteSpecificAnnotations", 'SNVs & PTMs', []);
        this.setAllAnnotations(model);
        this.siteSpecificAnnotations.addRow(new Row("DoCM", [], colors["DoCM"], true));

        this.ipsMotifs = this.getIpsMotifs(model);
        this.elmMotifs = this.getElmMotifs(model);
        this.pdbHomology = this.getPdbHomology(model);
        this.alignments = undefined;

        this.warning = undefined;
        this.note = this.getNote(model);

        this.ISOFORM_MSA = model['ISOFORM_MSA'];
        this.PARALOG_MSA = model['PARALOG_MSA'];
        this.setAlignments('ISOFORM_MSA');
        this.addSeries("LitVar", Object.values(model['litvar']));

        Promise.all(this.loadGeneAsync())
            .then(() => modelDone(this, {variantInfo: model.variant_info}))
            .catch(() => modelDone(this, {variantInfo: model.variant_info}))
    }
    mapTrack(key, track){
        key = key.replace(" ", "_")
        let siteSpecificProps = this.getSiteSpecificProps();
        
        if (key in siteSpecificProps && track[key]){
            return track[key].map(this.siteSpecificProps[key]).filter(interval => interval.start !== undefined);
        } else if (key === "CCDS"){
            return this.getExonAnnotations(track);
        } else if (key === "gnomad"){
            return this.getGnomadData(track);
        } else if (key === "ips"){
            return this.getIpsMotifs(track);
        } else if (key === "ELM"){
            return this.getElmMotifs(track);
        } else if (key === "PDB"){
            return this.getPdbHomology(track)
        }
    }
    setAlignments(msaType){
        this.warning = undefined;
        let alignment = this[msaType];
        let strType = msaType.split("_")[0].toLowerCase();
        if (!alignment || alignment == "No paralogs found" || alignment == "No isoforms found"){
            this.warning = `No ${strType}s for ${this.ensemblGeneSymbol} are found in Ensembl.
                See <a class='dialog-link' href='http://www.ensembl.org/Multi/Search/Results?q=${this.ensemblGeneSymbol}
                ' target="_blank" rel="noopener noreferrer">Ensembl</a> for more information.`;
                
            $(".dialog-message").html(this.warning);
            $(".custom-dialog").show().css({display: "flex"});
            this.alignments = null;
        } else {
            this.alignments = JSON.parse(alignment).map((curr, i) => {
                return{
                    ID: curr.ID[0],
                    seq: curr.Seq[0]
                }
            });
        }
    }
    setSequence(seq){
        this.seq = seq
    }
    groupSameText(a, b) {
        return a.text === b.text;
    }
    addSeries(key, data) {
        let intervals = data.map(this.siteSpecificProps[key]);
        let color = colors[key];
        let groupedIntervals = groupIntervals(intervals, this.groupSameText);
        let row = new Row(key, groupedIntervals, color);

        let index = -1;
        if (this.siteSpecificAnnotations !== null){
            for (let i = 0; i < this.siteSpecificAnnotations.rows.length; i ++){
                let row = this.siteSpecificAnnotations.rows[i];
                if (row.name === key){
                    index = i;
                    break;
                }
            }
        }

        if (index >= 0){
            //If this annotation type already exists, replace it rather than adding again
            this.siteSpecificAnnotations.rows[index] = row;
        } else {
            this.siteSpecificAnnotations.addRow(row);
        }
    }
    removeSeries(name){
        this.siteSpecificAnnotations.rows = this.siteSpecificAnnotations.rows.filter(x => x.name !== name);
    }
    setAllAnnotations(model) {
        Object.keys(this.siteSpecificProps).map(key => {
            if (model.hasOwnProperty(key)) {
                let intervals = model[key].map(this.siteSpecificProps[key]).filter(interval => interval.start !== undefined);
                let color = colors[key];
                let groupedIntervals = groupIntervals(intervals, this.groupSameText);
                let row = new Row(key, groupedIntervals, color);
                this.siteSpecificAnnotations.addRow(row);
            }
            return
        })
    }
    getIpsMotifs(model) {
        let result = null;
        if (model.hasOwnProperty("ips")) {
            let data = model.ips;
            result = new RowGroup("ipsMotifs", "Domains & Motifs", []);
    
            let uniqueTypes = data.map(function (obj) {
                return obj.analysis_type;
            }).filter(x => x !== undefined).getUnique().sort();
            
            let entryToInterval = function (entry) {
                let url = "https://www.google.com/search?q=" + entry.id; // default url = Google Search
                if (entry.analysis_type == 'Gene3D' && entry.id) {
                    url = "http://www.cathdb.info/version/latest/superfamily/" +
                        entry.id.replace('G3DSA:', '')
                }
                else if (entry.analysis_type == 'Pfam') {
                    url = "http://pfam.xfam.org/family/" + entry.id
                }
                else if (entry.analysis_type == 'PRINTS') {
                    url = "http://www.bioinf.manchester.ac.uk/cgi-bin/dbbrowser/sprint/searchprintss.cgi?prints_accn=" +
                        entry.id
                }
                else if (entry.analysis_type == 'ProSitePatterns') {
                    url = "http://prosite.expasy.org/" + entry.id
                }
                else if (entry.analysis_type == 'ProSiteProfiles') {
                    url = "http://prosite.expasy.org/" + entry.id
                }
                else if (entry.analysis_type == 'SUPERFAMILY') {
                    url = "http://supfam.cs.bris.ac.uk/SUPERFAMILY/cgi-bin/scop.cgi?ipid=" + entry.id
                }
                else if (entry.analysis_type == 'UniProt') {
                    url = "http://www.uniprot.org/uniprot/" + entry.id
                }
                
                let desc = entry.interpro_description;
                if (!desc){
                    desc = entry.code;
                }

                if (!!desc){
                    desc = `: ${desc}`
                } else {
                    desc = "";
                }

                return new Interval(+entry.interpro_start, +entry.interpro_end,
                    `${entry.analysis_type}  (${entry.id})${desc}`,
                    undefined, undefined, url);
            };
    
            for (let i = 0; i < uniqueTypes.length; i++) {
                let uniqueType = uniqueTypes[i];
    
                let subsetForType = data.filter(function (obj) {
                    return obj.analysis_type == uniqueType;
                });
                
                if (!uniqueType){
                    uniqueType = "IPS";
                }
                let row = new Row(uniqueType, subsetForType.map(entryToInterval).filter(x => x !== null), ipsColors[uniqueType]);
                result.addRow(row);
            }
        }
        return result;
    }
    // Note to be displayed below the plots
    getNote(model) { 
        // Set the note
        let PDBhits = 0;
        let nPDBhist = 0;
        let totalPDBHits = 0;
        if (model.hasOwnProperty('PDBCount')) {
            PDBhits = model['PDBCount'];
            let rgx = /\d+/g;
            let eachCount = PDBhits.match(rgx);
            
            for (let i = 0; i < eachCount.length; i ++){
                totalPDBHits += parseInt(eachCount[i], 10);
            }
            if (totalPDBHits === 0){
                PDBhits = 0;
            }
        }
        if (model.hasOwnProperty('PDB')) {
            nPDBhist = model['PDB'].length;
        }

        let brevityNote = "";
        if (totalPDBHits > nPDBhist){
            brevityNote = `We are showing the top ${nPDBhist} most distinct (by protein sequence coverage) for brevity.`;
        }
        return (
            `${this.ensemblGeneSymbol} has ${PDBhits} homologous hits to the PDB. ${brevityNote}
            <br> 
                Annotations shown are anchored to UniProt sequence 
                <a href='http://www.uniprot.org/uniprot/${model['uniprot_id']}'>
                    ${model['uniprot_id']}
                </a>
                which mapped to 
                <a href='http://www.ensembl.org/id/${model['ensp']}'>
                    ${model['ensp']}
                </a>
                which is translated from 
                <a href='http://www.ensembl.org/id/${model['enst']}'>
                    ${model['enst']}.
                </a>
            </br>`
        );
    }
    getSiteSpecificProps(){
        return({
            ClinVar_Patho: obj => {
                let url;
                let aaChange = `${obj['CAVA_PROTREF']}${obj['CAVA_PROTPOS']}${obj['CAVA_PROTALT']}`
                if (aaChange.match(/X$/)) {
                    url = `http://www.ncbi.nlm.nih.gov/clinvar/?term=${this.ensemblGeneSymbol}[gene]`;
                } else {
                    url = `http://www.ncbi.nlm.nih.gov/clinvar/?term=${this.ensemblGeneSymbol}[gene]${aaChange}`;
                }
                return new Interval(
                    +obj['CAVA_PROTPOS'],
                    +obj['CAVA_PROTPOS'] + obj['AA_LEN'] - 1,
                    aaChange + ` : ` + obj['ALL_TRAITS'],
                    undefined,
                    undefined,
                    url);
            },
            ClinVar_Other: obj => {
                let url;
                let aaChange = `${obj['CAVA_PROTREF']}${obj['CAVA_PROTPOS']}${obj['CAVA_PROTALT']}`
                if (aaChange.match(/X$/)) {
                    url = `http://www.ncbi.nlm.nih.gov/clinvar/?term=${this.ensemblGeneSymbol}[gene]`;
                } else {
                    url = `http://www.ncbi.nlm.nih.gov/clinvar/?term=${this.ensemblGeneSymbol}[gene]${aaChange}`;
                }
                return new Interval(
                    +obj['CAVA_PROTPOS'],
                    +obj['CAVA_PROTPOS'] + obj['AA_LEN'] - 1,
                    aaChange + ` : ` + obj['ALL_TRAITS'],
                    undefined,
                    undefined,
                    url);
            },
            ClinVar_Benign: obj => {
                let url;
                let aaChange = `${obj['CAVA_PROTREF']}${obj['CAVA_PROTPOS']}${obj['CAVA_PROTALT']}`
                if (aaChange.match(/X$/)) {
                    url = `http://www.ncbi.nlm.nih.gov/clinvar/?term=${this.ensemblGeneSymbol}[gene]`;
                } else {
                    url = `http://www.ncbi.nlm.nih.gov/clinvar/?term=${this.ensemblGeneSymbol}[gene]${aaChange}`;
                }
                return new Interval(
                    +obj['CAVA_PROTPOS'],
                    +obj['CAVA_PROTPOS'] + obj['AA_LEN'] - 1,
                    aaChange + ` : ` + obj['ALL_TRAITS'],
                    undefined,
                    undefined,
                    url);
            },
            HGMD: obj => {
                let url = `http://www.hgmd.cf.ac.uk/ac/gene.php?gene=${this.ensemblGeneSymbol}`;
                return new Interval(
                    +obj['CAVA_PROTPOS'],
                    +obj['CAVA_PROTPOS'],
                    obj['PROT'] + ` : ` + obj['PHEN'],
                    undefined,
                    undefined,
                    url);
            },
            uniprot_sites: obj => {
                let url = `http://www.uniprot.org/uniprot/${this.uniprotId}`;
                return new Interval(
                    +obj['start'],
                    +obj['stop'],
                    obj[`category`] + ` : ` + obj[`description`],
                    undefined,
                    undefined,
                    url);
            },
            uniprot_variants: obj => {
                let url = `http://www.uniprot.org/uniprot/${this.uniprotId}`;
                return new Interval(
                    +obj['start'],
                    +obj['stop'],
                    [obj[`ref`] + obj[`start`] + obj[`alt`], obj[`disease`], 
                    obj[`description`]].filter(function (val) { return val; }).join(': '),
                    undefined,
                    undefined,
                    url);
            },
            PTMCode2: obj => {
                let url = `http://ptmcode.embl.de/search.cgi?species=9606&protein=${this.ensemblGeneSymbol}`;
                return new Interval(
                    +obj['pos'],
                    +obj['pos'],
                    obj['Residue1'] + ` : ` + obj['PTM1'],
                    undefined,
                    obj['col'],
                    url);
            },
            PhosphoSitePlus: obj => {
                let url = `http://www.phosphosite.org/simpleSearchSubmitAction.action?searchStr=${this.ensemblGeneSymbol}`;
                return new Interval(
                    +obj['pos'], 
                    +obj['pos'], 
                    obj['MOD_RSD'], 
                    undefined, 
                    obj['col'], 
                    url);
            },
            DoCM: obj => {
                let url = `http://www.ncbi.nlm.nih.gov/pubmed/${obj['pmid']}`;
                return new Interval(
                    +obj['pos'], 
                    +obj['pos'], 
                    obj['disease'], 
                    undefined, 
                    undefined, 
                    url);
            },
            LitVar: obj => {
                let url = obj.pmid;
                return new Interval(
                    +obj['pos'], 
                    +obj['pos'], 
                    obj['disease'], 
                    undefined, 
                    undefined, 
                    url);
            }
        })
    }
    getPdbHomology(model) {
        let result = null;
        if (!model.hasOwnProperty("PDB")) {
            return(null);
        } 
        
        let data = model.PDB;
        result = new RowGroup("pdbHomology", "3D Structures", []);

        let uniqueTypes = data.map(function (obj) {
            return obj.PDB;
        }).filter(x => x !== undefined).getUnique().sort();

        let entryToInterval = function (entry) {
            if (!entry.PDB){
                return null;
            }
            let color = "#CC0000"; // red
            if ((+entry.Identity >= 70) || (+entry.Positive >= 75)) {
              color = "#009900"; // dark green
            }
            else if ((+entry.Identity >= 40) || (+entry.Positive >= 60)) {
              color = "#FFD700"; // gold
            }
            let id = entry.PDB.replace(/_(\w+)$/i, "");
            let url = "http://www.rcsb.org/pdb/explore/explore.do?structureId=" + id;

            return new Interval(+entry.QueryStart, +entry.QueryEnd,
                entry.PDB + ": " + entry.Identity + "% identity",
                0, color, url);
        }

        for (let i = 0; i < uniqueTypes.length; i++) {
            let uniqueType = uniqueTypes[i];

            let subsetForType = data.filter(obj => obj.PDB == uniqueType);

            let row = new Row(uniqueType, subsetForType.map(entryToInterval).filter(x => x !== null));
            result.addRow(row);
        }
        return result;
    }
    getElmMotifs(model) {
        let result = null;
        if (model.hasOwnProperty("ELM")) {
            let data = model.ELM;
            result = new RowGroup("elmMotifs", "Simple Motifs", []);

            let uniqueTypes = data.map(function (obj) {
                return obj.elm_identifier;
            }).getUnique().sort();

            let entryToInterval = function (entry) {
                let url = "http://elm.eu.org/elms/" + entry.elm_identifier
                return new Interval(+entry.start,
                    +entry.stop,
                    entry.elm_identifier,
                    undefined,
                    entry.Probability_color,
                    url);
            };

            for (let i = 0; i < uniqueTypes.length; i++) {
                let uniqueType = uniqueTypes[i];

                let subsetForType = data.filter(function (obj) {
                    return obj.elm_identifier == uniqueType;
                });

                let row = new Row(uniqueType, subsetForType.map(entryToInterval));
                result.addRow(row);
            }
        }
        return result;
    }

    // Return Gnomad data as an object:
    // - data: array of [x,y] tuples,
    // - yRange: array of [min, max] y value
    getGnomadData(model){
        if (model.hasOwnProperty('gnomad')) {
            let obj = model['gnomad'];
            let data = [];
            for (let i = 0; i < obj.length; i++) {
                let yVal = +obj[i]['AF'];
                if (isNaN(yVal)) {
                    continue;
                }

                let rec = [+obj[i]['CAVA_PROTPOS'], yVal];
                data.push(rec);
            }

            // We have array of amino acid - AF pairs
            let maxAF = data.reduce(function (value, item) {
                return Math.max(value, item[1]);
            }, 0);
            let minAF = data.reduce(function (value, item) {
                return Math.min(value, item[1]);
            }, maxAF);
            return { data: data, yRange: [minAF, maxAF] };
        }
        else {
            return null;
        }
    }

    // Return an array of exons with start, stop parameters
    // Start and stop are inclusive, 1-based
    getExonAnnotations(model){
        // Extract raw data
        if (model.hasOwnProperty("CCDS")) {
            let obj = model.CCDS;
            let ess_array = []; // Exon Start Stop array
            for (let x in obj) {
                if (obj.hasOwnProperty(x)) {
                    let ex1 = +(obj[x]['start_residue']);
                    let ex2 = +(obj[x]['stop_residue']);
                    ess_array.push([ex1, ex2]);
                }
            }

            // Sort data
            ess_array.sort(function compare(a, b) {
                return a[0] - b[0];
            });

            // Format the resulting array
            let result = [];
            for (let i = 0; i < ess_array.length; i++) {
                result.push({ start: ess_array[i][0] + 1, stop: ess_array[i][1] + 1, odd: (i % 2 == 0) });
            }
            return (result);
        }
        else {
            return [{ start: 1, stop: +model.numAA, noData: true }];
        }
    }

    // Returns a promise containing the JSON information about a given gene
    loadGeneAsync() {
        let withDoCM = async (res, rej) => {
            let docmData = [];
            
            let url = "http://www.docm.info/api/v1/variants.json?genes=" + this.ensemblGeneSymbol;
            let docm = await fetch(url, {"Content-Type": "application/json"});
            try {

                if (!this.canonicalIsoform){
                    throw new Error("Not canonical");
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
                                            disease: mut + ' in: ' + d.diseases.join(', '),
                                            pmid: d.pubmed_sources.join(',')
                    };
                    docmData.push(new_data);
                }
                this.addSeries("DoCM", docmData);
                res();
            } catch(err) {
                console.error(err)
                console.error("No DoCM data available!");
                this.removeSeries("DoCM")
                res();
            }
        }
        return [
            new Promise((res, rej) => withDoCM(res, rej) )
        ];
    }
}

// Interval from-to amino acid
// overlap = the Y coordinate to put the interval on to prevent overlaps (integer, starting at 0)
// group = a list of sub-intervals in case this is an interval group. The groups
// are displayed in a way indicating that there are more elements
function Interval(start, stop, text, overlap, color, url, group) {
    if (isNaN(start) || isNaN(stop)){
        return null;
    }
    this.start = start;
    this.stop = stop;
    this.text = text;
    if (overlap === undefined){
        overlap = 0;
    }
    this.overlap = overlap;
    this.color = typeof color !== 'undefined' ? color : null; // Color is optional
    this.url = typeof url !== 'undefined' ? url : null; // URL is optional
    this.group = typeof group !== 'undefined' ? group : null; // Group is optional
}

// A row of intervals
function Row(name, intervals, color, loading = false) {
    this.name = name.split("_").join(" ");
    this.intervals = intervals;
    this.maximumOverlap = layoutIntervals(intervals);
    this.color = color;
    this.loading = loading;
}

// Go over all intervals and create "group" intervals based on equivalence between input intervals.
// Two intervals are considered equivalent if their start,stop matches + a comparator function
// returns true on them
function groupIntervals(intervals, comparator) {
    let numIntervals = intervals.length;
    let order = new Array(numIntervals);
    for (let i = 0; i < numIntervals; i++) {
        order[i] = i;
    }
    order = order.sort(function (a, b) {
        return intervals[a].start - intervals[b].start ||
            intervals[a].end - intervals[b].end;
    });

    // Now order is order in which to process intervals so their start/end coordinates increase
    // Use this sorting for detecting duplicities
    let matching = [];
    let result = new Array(numIntervals);
    let numResult = 0;
    for (let j = 0; j < numIntervals;) {
        let index = order[j];
        let interval1 = intervals[index];
        matching[0] = interval1; // Put it into a group with itself
        let toGroup = [];
        toGroup[0] = interval1;
        let outK;
        for (let k = j + 1; k < numIntervals; k++) {
            outK = k;
            let interval2 = intervals[order[k]];
            if (
                interval1.start !== interval2.start ||
                interval1.end !== interval2.end) {
                break;
            }
            toGroup.push(interval2);
        }
        let matches = new Array(toGroup.length);
        while (toGroup.length > 0) {
            let first = toGroup[0];
            matches[0] = true; // Ourselves
            let numMatches = 1;
            for (let ii = 1; ii < toGroup.length; ii++) {
                let isMatch = comparator(toGroup[ii], first);
                matches[ii] = isMatch;
                if (isMatch) {
                    numMatches++;
                }
            }
            if (numMatches > 1) {
                result[numResult] = new Interval(
                    first.start,
                    first.stop,
                    first.text + " (" + numMatches + ")",
                    first.overlap,
                    first.color,
                    first.url,
                    // All grouped go in
                    toGroup.filter(function (element, i) { return matches[i] }));
            }
            else {
                result[numResult] = first;
            }
            numResult++;
            // Filter the grouped out
            toGroup = toGroup.filter(function (element, i) { return !matches[i] });
        }
        j = outK; // Skip to the first ungrouped
    }
    return result.slice(0, numResult);
}

// Fill in the 'overlap' filed for the row intervals, return maximum overlap
function layoutIntervals(intervals) {
    let startStops = [];
    for (let i = 0; i < intervals.length; i++) {
        let interval = intervals[i];
        startStops.push({ pos: interval.start * 2, start: true, i: i });
        startStops.push({ pos: interval.stop * 2 + 1, start: false, i: i }); // Stops behave as if they ended just after start
    }

    startStops.sort(function cmp(a, b) {
        if (a.pos != b.pos) {
            return a.pos - b.pos;
        }
        return a.start == false ? -1 : 1; // Ends go first
    });

    let currentOverlap = -1;
    let maximumOverlap = 0;
    for (let i = 0; i < startStops.length; i++) {
        let startStop = startStops[i];
        if (startStop.start) {
            currentOverlap++;
            intervals[startStop.i].overlap = currentOverlap; // Set the overlap position on the interval
            if (currentOverlap > maximumOverlap) {
                maximumOverlap = currentOverlap;
            }
        } else {
            currentOverlap--;
        }
    }
    return maximumOverlap;
}

// Group of rows. Color is optional.
function RowGroup(name, title, rows) {
    this.name = name;
    this.title = title;
    this.rows = rows;
    this.color = null;
}

// Calculate Y coordinate span that would the row group take assuming each row has height 1*maxOverlap
RowGroup.prototype.yDomain = function (spaceBetweenRows) {
    let maxY = 0;
    for (let i = 0; i < this.rows.length; i++) {
        if (i != 0) {
            maxY += spaceBetweenRows;
        }
        maxY += this.rows[i].maximumOverlap;
    }
    return [0, maxY];
};

RowGroup.prototype.addRow = function (row) {
    this.rows.push(row);
};
RowGroup.prototype.prependRow = function (row) {
    this.rows.unshift(row);
};