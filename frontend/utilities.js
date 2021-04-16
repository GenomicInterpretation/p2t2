// Default palette for different numbers of colors to distinguish
const palette = [
    ['#4477aa'],
    [
        '#4477aa',
        '#cc6677'
    ],
    [
        '#4477aa',
        '#ddcc77',
        '#cc6677'
    ],
    [
        '#4477aa',
        '#117733',
        '#ddcc77',
        '#cc6677'
    ],
    [
        '#332288',
        '#88ccee',
        '#117733',
        '#ddcc77',
        '#cc6677'
    ],
    [
        '#332288',
        '#88ccee',
        '#117733',
        '#ddcc77',
        '#cc6677',
        '#aa4499'
    ],
    [
        '#332288',
        '#88ccee',
        '#44aa99',
        '#117733',
        '#ddcc77',
        '#cc6677',
        '#aa4499'
    ],
    [
        '#332288',
        '#88ccee',
        '#44aa99',
        '#117733',
        '#999933',
        '#ddcc77',
        '#cc6677',
        '#aa4499'
    ],
    [
        '#332288',
        '#88ccee',
        '#44aa99',
        '#117733',
        '#999933',
        '#ddcc77',
        '#cc6677',
        '#882255',
        '#aa4499'
    ],
    [
        '#332288',
        '#88ccee',
        '#44aa99',
        '#117733',
        '#999933',
        '#ddcc77',
        '#661100',
        '#cc6677',
        '#882255',
        '#aa4499'
    ],
    [
        '#332288',
        '#6699cc',
        '#88ccee',
        '#44aa99',
        '#117733',
        '#999933',
        '#ddcc77',
        '#661100',
        '#cc6677',
        '#882255',
        '#aa4499'
    ],
    [
        '#332288',
        '#6699cc',
        '#88ccee',
        '#44aa99',
        '#117733',
        '#999933',
        '#ddcc77',
        '#661100',
        '#cc6677',
        '#aa4466',
        '#882255',
        '#aa4499'
    ]
];

// Colors for all the annotations in one place
const colors = {
    "ClinVar_Patho": '#CB333A', // medium red
    "ClinVar_Other": '#332288', // dark blue
    "ClinVar_Benign": '#117733', // dark green
    "HGMD": '#87222A', // dark red
    "PTMCode2": '#999933',
    "PhosphoSitePlus": '#ddcc77',
    "DoCM": '#cc6677',
    "MutD": '#aa4499',
    "UniProt": "#71b8d3",
    "uniprot_sites": "#1c5fcc",
    "uniprot_variants": "#71b8d3",
    "gnomad": "grey",
    "exons": "purple"
};
const ipsColors = {
    "CDD": "#232288",
    "Gene3D": "#332288",
    "Coils": "#999999",
    "Pfam": "#88ccee",
    "PRINTS": "#117733",
    "ProSitePatterns": "#ddcc77",
    "ProSiteProfiles": "#cc6677",
    "SUPERFAMILY": "#aa4499",
    "SMART": "#404040",
    "UniProt": "#71b8d3"
};
const Colors = {};
Colors.names = {
    aqua: "#00ffff",
    azure: "#f0ffff",
    beige: "#f5f5dc",
    blue: "#0000ff",
    brown: "#a52a2a",
    cyan: "#00ffff",
    darkblue: "#00008b",
    darkcyan: "#008b8b",
    darkgrey: "#a9a9a9",
    darkkhaki: "#bdb76b",
    darkmagenta: "#8b008b",
    darkolivegreen: "#556b2f",
    darkorange: "#ff8c00",
    darkorchid: "#9932cc",
    darkred: "#8b0000",
    darksalmon: "#e9967a",
    darkviolet: "#9400d3",
    fuchsia: "#ff00ff",
    gold: "#ffd700",
    indigo: "#4b0082",
    khaki: "#f0e68c",
    lightblue: "#add8e6",
    lightcyan: "#e0ffff",
    lightgreen: "#90ee90",
    lightgrey: "#d3d3d3",
    lightpink: "#ffb6c1",
    lightyellow: "#ffffe0",
    lime: "#00ff00",
    magenta: "#ff00ff",
    maroon: "#800000",
    navy: "#000080",
    olive: "#808000",
    orange: "#ffa500",
    pink: "#ffc0cb",
    purple: "#800080",
    violet: "#800080",
    red: "#ff0000",
    silver: "#c0c0c0",
    white: "#ffffff",
    yellow: "#ffff00"
};

Colors.random = function() {
    let result;
    let count = 0;
    for (let prop in this.names)
        if (Math.random() < 1/++count)
            result = prop;
    return result;
};

let endpointVar = "http://p2t2.hmgc.mcw.edu/api";//"http://10.0.2.2:5000/api";//
if (location.hostname === 'localhost') {
    endpointVar = "http://localhost:5000/api";
}
const laneNames = ["seq", "gnomad", "siteSpecificAnnotations", "ipsMotifs", "elmMotifs", "pdbHomology", "alignments"]
const spaceBetweenRows = 1;
const proteinLaneHeight = 20;
const gnomadLaneHeight = 80;

// Returns a const, that, as long as it continues to be invoked, will not
// be triggered. The const will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the const on the
// leading edge, instead of the trailing.
const debounce = (func, wait, immediate) => {
    let timeout;
    return function(){
        let context = this, args = arguments;
        let later = function(){
            timeout = null;
            if (!immediate) {
                func.apply(context, args);
            }
        };
        let callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) {
            func.apply(context, args);
        }
    };
};

const getLaneHeight = (dataModel, lane) => {

    let heightMap = {
        siteSpecificAnnotations: x => x * 15,
        ipsMotifs: x => Math.min(x * 10, 100),
        elmMotifs: x => Math.min(x * 3, 300),
        pdbHomology: x => x * 15
    }
    let out = 0
    let extraHeight = 50;

    if (lane === "seq"){
        out = proteinLaneHeight;
    } else if (lane === "gnomad"){
        out = gnomadLaneHeight + extraHeight;
    } else if (lane === "alignments"){
        out = dataModel[lane].length * proteinLaneHeight;
    } else if (dataModel[lane]){
        out = heightMap[lane](dataModel[lane].yDomain(spaceBetweenRows)[1]) + extraHeight;
    }
    
    return out;
}

const ySpace = 10 + 25; // Spacing between lanes
const nucleotides = ["G", "A", "T", "C", "U"];
const aminoAcids = ["A", "R", "N", "D", "B", "C", "E", "Q", "Z", "G", "H", "I", "L", "K", "M", "F", "P", "S", "T", "W", "Y", "V"];

const ncbiEndpoint = "https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi";
const ncbiPrograms = [
    {name:'megablast', desc: 'nucleotide :: nucleotide, fast, highly similar blast'},
    {name: 'blastn', desc: 'nucleotide :: nucleotide, min 11 bp exact match'},
    {name: 'blastp', desc: 'protein :: protein'},
    {name: 'rpsblast', desc: 'protein :: protein, alternate algorithm'},
    {name: 'blastx', desc: 'translated nucleotide :: protein'},
    {name: 'tblastn', desc: 'protein :: translated nucleotide'},
    {name: 'tblastx', desc: ''}
];
const ncbiDbs = [
    {name: "nt", desc: "Nucleotide collection", operand: "DNA"},
    {name: "nr", desc: "Non-redundant", operand: "Protein"},
    {name: "refseq_rna", desc: "NCBI Transcript Reference Sequences", operand: "DNA"},
    {name: "refseq_protein", desc: "NCBI Protein Reference Sequences", operand: "Protein"},
    {name: "swissprot", desc: "Non-redundant UniProtKB/SwissProt sequences", operand: "Protein"},
    {name: "pdbaa", desc: "PDB protein database", operand: "Protein"},
    {name: "pdbnt", desc: "PDB nucleotide database", operand: "DNA"},
]
const getBlastURL = (query, type) => {
    let db = "";
    let program = "";
    if (type === "nucleotide"){
        db = "nt";
        program = "blastn"
    } else if (type === "protein"){
        db = "nr";
        program = "blastp"
    } else {
        return false;
    }
    
    let url = `${ncbiEndpoint}?CMD=Put&PROGRAM=${program}&DATABASE=${db}&QUERY=${query}&FORMAT_TYPE=JSON2`;
    return url;
}

const getTrack = (key, data) => {
    let residues;
    if (key === "gnomad"){
        data = data.data;
        residues = data.map(arr => arr[0]);

    } else if (key === "exons"){
        residues = data.map(obj => obj.start);

    } else if (key in ipsColors) {
        residues = data[0].intervals.map(obj => {
            return Array(obj.stop - obj.start).fill(0).map((x, i) => '' + (i + obj.start));
        }).flat().filter(onlyUnique);

    } else if (data[0] && data[0].intervals){
        data = data[0].intervals;
        residues = data.map(obj => '' + obj.start);

    } else {
        residues = data.map(obj => obj.start);

    }
    return residues;
}

const msaToSeqPos = (msaSeq) => {
    /* Returns 1-indexed position map from msa to sequence
    * This is an object of length msaSeq
    *
    * @param msaSeq the sequence including gaps
    * 
    *       key       -> val
    *       MSA pos -> seq pos
    * e.g. given --AB-C
    *    -    -    A    B    -    C
    *   1:0, 2:0, 3:1, 4:2, 5:2, 6:3
    */

    let sequenceMap = {};
    msaSeq.split("").reduce((gapCount, res, i) => {
        if (res !== "-"){
            gapCount += 1;
        }
        sequenceMap[i + 1] = gapCount
        return gapCount;
    }, 0);
    return sequenceMap;
}
const seqToMsaPos = (msaSeq) => {
    /* Returns 1-indexed position map from sequence to MSA
    * This is an object of the length of msaSeq with gaps removed (i.e. the original sequence)
    *
    * @param msaSeq the sequence including gaps
    * 
    *  e.g. given --AB-C
    *  1:3, 2:4, 3:6
    */

    let sequenceMap = msaToSeqPos(msaSeq);
    let splitSeq = msaSeq.split("");
    sequenceMap = Object.values(sequenceMap).reduce((acc, sequenceIndex, i) => {
        if (sequenceIndex === 0){
            sequenceIndex = 1;
        }
        if (splitSeq[i] !== "-"){
            acc[sequenceIndex] = i + 1;
        }
        return acc;
    }, {});
    return sequenceMap;
}

const fetchTrack = async (uniprotId, track) => {
    let headers = { "Content-Type": "application/json" };
    let body = JSON.stringify({ uniprotId, track });
    let tmp = await fetch(`${endpointVar}/fetch_track`, { headers, body, method: "POST" });

    //Structure data sent as json-encoded array of byte strings
    let modelData = await tmp.json();
    modelData = JSON.parse(modelData);
    return(modelData)
}
const onlyUnique = (value, index, self) => { 
    return self.indexOf(value) === index;
}
let aaLetters = 'ARNDBCEQZGHILKMFPSTWYV';
const variantRgxs = {
    full: new RegExp(`[${aaLetters}]+\\d+[${aaLetters}]+`),
    ref: new RegExp(`([${aaLetters}]+)\\d+[${aaLetters}]+`),
    pos: new RegExp(`[${aaLetters}]+(\\d+)[${aaLetters}]+`),
    alt: new RegExp(`[${aaLetters}]+\\d+([${aaLetters}]+)`)
}
const extraTitleHeight = 10;

export {extraTitleHeight, variantRgxs, onlyUnique, fetchTrack, msaToSeqPos, seqToMsaPos, 
    getTrack, getBlastURL, ySpace, Colors, ipsColors, colors, palette, endpointVar, laneNames, 
    spaceBetweenRows, proteinLaneHeight, gnomadLaneHeight, debounce, getLaneHeight};