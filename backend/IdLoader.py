from .utilities import *
from .settings import *
from .constants import *

import requests
import re

class IdLoader:
    def __init__(self, query, subset=None):
        self.query = query
        self.subset = subset
        self.id_type = ''
        self.translate = False
        self.variant_info = None
        self.db_query = {}

    def get_db_query(self):
        return self.db_query

    def get_id_type(self):
        return self.id_type

    def get_translate(self):
        return self.translate

    def get_variant_info(self):
        return self.variant_info

    def make_query(self):
        query = self.query
        res = re.match(gdot_rgx, query, re.IGNORECASE)

        if res:
            query = res.group(1)
            self.variant_info = res.group(0)[len(query):]
            self.translate = True
        else:
            res = re.match(pdot_rgx, query, re.IGNORECASE)
            if res:
                ref = re.match(pdot_ref_rgx, query, re.IGNORECASE).group(1)
                alt = re.match(pdot_alt_rgx, query, re.IGNORECASE).group(1)
                pos = re.match(pdot_pos_rgx, query, re.IGNORECASE).group(1)
                query = res.group(1)

                # Variant info only gets updated by N*_ queries, other ID types will not populate it
                if id_query(query) != "NCBI_PROTEIN":
                    self.variant_info = {
                        "ref": ref,
                        "alt": alt,
                        "pos": pos,
                    }
                else:
                    self.variant_info = res.group(0)[len(query):]

        self.id_type = id_query(query)

        if self.id_type == "gene_symbol":
            # For now, remove version identifiers
            version_index = query.find(".")
            if version_index >= 0:
                query = query[:version_index]
            query = query.upper()
            other_fields = {"canonical_isoform": True}
            self.db_query = {"$or": [{"gene_symbol": query},
                                {"ensembl_gene_symbol": query}]}
            self.db_query.update(other_fields)

        elif self.id_type == "uniprot_id":
            # For now, remove version identifiers
            version_index = query.find(".")
            if version_index >= 0:
                query = query[:version_index]
            # Search canonical transcript by default
            id_char = query.find("-")
            if id_char >= 0 and query[id_char + 1:] == 1:
                # Searching for canonical uniprot isoform - stored without version
                query = query[:id_char]

            other_fields = {}
            self.db_query = {"{0}".format(self.id_type): query}
            self.db_query.update(other_fields)

        elif self.id_type == "HGVS":
            out = mvi_query(query)
            query = out[0]
            # replace genomic variant info with protein
            self.variant_info = out[1]
            self.translate = False
            other_fields = {}
            self.db_query = {"{0}".format("enst"): query}
            self.db_query.update(other_fields)

        elif self.id_type == "NCBI_NUCLEIC":
            if self.variant_info is not None:
                query = query + self.variant_info
            out = ar_nucleic_query(query)
            query = out[0]
            # replace genomic variant info with protein
            self.variant_info = out[1]
            self.translate = False
            other_fields = {}
            self.db_query = {"{0}".format("enst"): query}
            self.db_query.update(other_fields)

        elif self.id_type == "NCBI_PROTEIN":
            out = ar_protein_query(query + self.variant_info)
            query = out[0]
            self.variant_info = out[1]
            self.translate = False
            other_fields = {}
            self.db_query = {"{0}".format("enst"): query}
            self.db_query.update(other_fields)

        else:
            # Handle ENST or ENSP
            # For now, remove version identifiers
            version_index = query.find(".")
            if version_index >= 0:
                query = query[:version_index]
            other_fields = {}
            self.db_query = {"{0}".format(self.id_type): query}
            self.db_query.update(other_fields)

        if self.subset is not None:
            position = self.subset
            subset = {}
            for site_key in db_references['SITE'].keys():
                if self.subset.position:
                    pass
                elif self.subset.variant:
                    pass

                subset[site_key] = curr_key
            curr_key = {"$and": {"$gt": db_references['SITE'][site_key]}}

    def translate_variant_info(self, gene_symbol):
        if self.translate:
            gn_query = gene_network_url + gene_symbol
            res = requests.get(gn_query)
            if res.status_code < 299:
                try:
                    res_json = res.json()
                    chrom = res_json['gene']['chr']
                    mvi_query_string = "chr{0}{1}".format(
                        chrom, self.variant_info)
                    mvi_res = mvi_query(mvi_query_string)
                    self.variant_info = mvi_res[1]
                except Exception as e:
                    print(e)
'''
db.transcripts.aggregate(
    {"$match": {"ensembl_gene_symbol": {"$eq": "KRAS"}}},
    {"$project": {
        "ClinVar_Patho": {
            "$filter": {
                "input": "$ClinVar_Patho",
                "as": "item",
                "cond": {
                    "$eq": [
                        "$$item.CAVA_PROTPOS", "61"
                    ]
                }
            }
        }
    }}
)
'''
