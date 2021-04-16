import re
import json
from .constants import *
from bson import ObjectId
import requests

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return json.JSONEncoder.default(self, obj)


class PDBEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (bytes, bytearray)):
            return obj.decode('ascii')
        # Let the base class default method raise the TypeError
        return json.JSONEncoder.default(self, obj)



def id_query(query):
    """
    Categorize the user query for different flavors of data lookup
    """
    
    if query[0:4].upper() == "ENSP":
        return "ensp"

    elif query[0:4].upper() == "ENST":
        return "enst"
        
    elif query[0:3].upper() == "CHR":
        return "HGVS"

    elif query[0:3].upper() in NCBI_NUCLEIC_PREFIXES or query[0:3].upper() in NCBI_RNA_PREFIXES:
        # Nucleic and Transcript prefixes have the same URL
        return "NCBI_NUCLEIC"

    elif query[0:3].upper() in NCBI_PROTEIN_PREFIXES:
        return "NCBI_PROTEIN"

    elif re.search(UNIPROT_ACC_RGX, query) is not None:
        return "uniprot_id"

    # Unrecognized string, 
    return "gene_symbol"

def mvi_query(query, version=38):
    """
    Returns ENST ID for variants in the form CHRX:g.00A>T
    """
    version_string = "?assembly=hg{0}".format(version)
    url = "{0}{1}{2}".format(my_variant_info_url, query, version_string)
    res = requests.get(url)
    if res.status_code > 299:
        return (False, None)
    try:
        res_json = res.json()
        enst = res_json['dbnsfp']['ensembl']['transcriptid']
        if isinstance(enst, list):
            enst = enst[0]
        pos = res_json['dbnsfp']['aa']['pos']
        if isinstance(pos, list):
            pos = pos[0]
        ref = res_json['dbnsfp']['aa']['ref']
        if isinstance(ref, list):
            ref = ref[0]
        alt = res_json['dbnsfp']['aa']['alt']
        if isinstance(ref, list):
            alt = alt[0]
        alteration = {
            "ref": ref,
            "alt": alt,
            "pos": pos,
        }
        if isinstance(enst, list):
            enst = enst[0]
    except Exception as e:
        print(e)
        return (False, None)
    return (enst, alteration)

def ar_nucleic_query(variant):
    """
    Returns ENST ID for variants in the form NC_X:g.00A>B using the allele registry API
    """
    url = "{0}{1}".format(ar_nucleic_url, variant)
    res = requests.get(url)
    if res.status_code > 299:
        return (False, None)

    try:
        mvi_id = res.json()['externalRecords']['MyVariantInfo_hg38'][0]["id"]
        if isinstance(mvi_id, list):
            mvi_id = mvi_id[0]
    except Exception as e:
        print(e)
        return (False, None)
    
    return mvi_query(mvi_id)

def ar_protein_query(protein_variant):
    """
    Returns ENST ID for variants in the form NP_X:p.A00B using the allele registry API
    """
    query = format_ar_protein_query(protein_variant)
    url = "{0}{1}".format(ar_nucleic_url, query)
    res = requests.get(url)
    if res.status_code > 299:
        return (False, None)

    try:
        variant = res.json()['aminoAcidAlleles'][0]['hgvsMatchingTranscriptVariant']
        if isinstance(variant, list):
            variant = variant[0]
    except Exception as e:
        print(e)
        return (False, None)

    return ar_nucleic_query(variant)

def format_ar_protein_query(query):
    """
    Remove () characters, convert AA codes to letters, etc. formatting for allele registry lookup
    """
    return query.replace("(", "").replace(")", "")