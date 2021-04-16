UNIPROT_ACC_RGX = '[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}'
ENSEMBL_PREFIXES = ['ENSP', 'ENST']
NCBI_NUCLEIC_PREFIXES = ['AC_', 'NC_', 'NG_', 'NT_', 'NW_', 'NZ_']
NCBI_RNA_PREFIXES = ['NM_', 'NR_', 'XM_', 'XR_']
NCBI_PROTEIN_PREFIXES = ['AP_', 'NP_', 'YP_', 'XP_', 'WP_']

my_variant_info_url = 'http://myvariant.info/v1/variant/'
ar_nucleic_url = 'http://reg.test.genome.network/allele?hgvs='
ar_rs_url = 'http://reg.test.genome.network/refseq='

aa_letters = 'ARNDBCEQZGHILKMFPSTWYV'
gene_network_url = 'https://www.genenetwork.nl/api/v1/gene/'
gdot_rgx = r'(.*):g.\d+[GATCU]+>[GATCU]+'
pdot_rgx = r'(.*):p.[{0}]+\d+[{0}]+'.format(aa_letters)
pdot_ref_rgx = r'.*:p.([{0}]+)\d+[{0}]+'.format(aa_letters)
pdot_pos_rgx = r'.*:p.[{0}]+(\d+)[{0}]+'.format(aa_letters)
pdot_alt_rgx = r'.*:p.[{0}]+\d+([{0}]+)'.format(aa_letters)

db_references = {
    'SITE': {
        'ClinVar_Patho': {
            'pos': 'CAVA_PROTPOS',
            'ref': 'CAVA_PROTREF',
            'alt': 'CAVA_PROTALT'
        },
        'ClinVar_Other': {
            'pos': 'CAVA_PROTPOS',
            'ref': 'CAVA_PROTREF',
            'alt': 'CAVA_PROTALT'
        },
        'ClinVar_Benign': {
            'pos': 'CAVA_PROTPOS',
            'ref': 'CAVA_PROTREF',
            'alt': 'CAVA_PROTALT'
        },
        'HGMD': {
            'pos': 'CAVA_PROTPOS',
            'ref': 'CAVA_PROTREF',
            'alt': 'CAVA_PROTALT'
        },
        'uniprot_sites': {
            'pos': 'start',
        },
        'uniprot_variants': {
            'pos': 'start',
            'ref': 'ref',
            'alt': 'alt'
        },
        'PTMCode2': {
            'pos': 'pos',
        },
        'PhosphoSitePlus': {
            'pos': 'pos',
        },
    },
    'REGION': {
        'ips': {
            'start': 'interpro_start',
            'end': 'interpro_end'
        },
        'PDB': {
            'start': 'QueryStart',
            'end': 'QueryEnd'
        },
        'swissprot_model': {
            'start': 'from',
            'end': 'to'
        },
        'ELM': {
            'start': 'start',
            'end': 'stop'
        }
    }
}
