from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from pymongo import MongoClient
from json import JSONEncoder
import os
import pymongo
import traceback

from .constants import *
from .utilities import *
from .settings import *
from .IdLoader import *

def create_app(test_config=None):
    app = Flask(__name__)

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    dev_route = ""
    if os.environ.get("FLASK_ENV") == "development":
        dev_route = "/api"

    @app.route('{0}/subset_transcript'.format(dev_route), methods=['POST'])
    def subset_transcript():
        '''
        Load a part of data for a single transcript
        Request body should be formatted like
        {   query: id,
            subset: {
                data
            }
        }
        Note that if the main query id contains a p. or c. variant, this will be used to sub
        '''
        req_json = request.get_json()
        query = req_json['query']
        subset = req_json['subset']

    @app.route('{0}/variant'.format(dev_route), methods=['POST'])
    def load_variant():
        '''
        Retrieve all annotations for a transcript at the specified position 
        and only for the specified variant
        '''
        req_json = request.get_json()
        gene = req_json['gene_symbol']
        position = req_json['position']
        alt = req_json['alt']

    @app.route('{0}/position'.format(dev_route), methods=['POST'])
    def load_position():
        '''
        Retrieve all annotations for a transcript at the specified position
        '''
        req_json = request.get_json()
        query = req_json['query']
        position = req_json['position']
        loader = IdLoader(query, position)

    @app.route('{0}/load_transcript'.format(dev_route), methods=['POST'])
    def load_transcript():
        req_json = request.get_json()
        loader = IdLoader(req_json['query'])
        loader.make_query()

        client = MongoClient(DB_HOST, DB_PORT)
        db = client[DB_NAME]
        coll = db[COLLECTION_NAME]
        data = list(coll.find(loader.get_db_query()))

        if len(data) > 0:
            data = data[0]
        else:
            return jsonify(JSONEncoder().encode({"Message": "Not found", "id_type": loader.get_id_type()})), 400

        # When given any non N*_ g. ID, the variant info needs to be translated to protein
        # the N*_ case uses the allele registry API to get that information automatically
        loader.translate_variant_info(data["ensembl_gene_symbol"])

        # Data fields to retrieve for isoform-transcripts
        proj = {"enst": 1, "uniprot_id": 1}

        # Get other transcripts that map to the same protein-isoform as the queried transcript
        out = list(coll.find({"uniprot_id": data['uniprot_id']}, proj))
        same_isoform_transcripts = {"same_isoform_transcripts": out}

        # Get transcripts that map to different isoforms of the same protein as the queried transcript
        out = list(coll.find({"gene_symbol": data['gene_symbol']}, proj))
        other_isoform_transcripts = {"other_isoform_transcripts": out}

        data.update(same_isoform_transcripts)
        data.update(other_isoform_transcripts)
        data.update({"id_type": loader.get_id_type()})
        data.update({"variant_info": loader.get_variant_info()})
        #Fetch data from APIS
        #LitVar
        symbol = data['ensembl_gene_symbol']
        url = 'https://www.ncbi.nlm.nih.gov/research/bionlp/litvar/api/v1/entity/search/{0}'.format(symbol)
        headers = {'User-Agent': 'Mozilla/5.0 (X11; CrOS x86_64 12871.102.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.141 Safari/537.36'}
        nlp = requests.get(url, headers=headers, timeout=0.5)
        
        if nlp.status_code == 200 and data['canonical_isoform']:
            nlpOut = nlp.json()
            rsIds = []
            nlpData = {}
            for d in nlpOut:
                rsId = d['rsid']
                re1 = '^(p.)'
                re2 = '([A-Z]+)(\d+)([A-Z]+)'
                hgvs = d['hgvs_prot']
                if not hgvs:
                    continue
                mut = re.sub(re1, '', hgvs)
                if mut == hgvs:
                    continue
                diseases = list(d['diseases'])
                if not diseases or len(diseases) < 1:
                    continue
                split = re.split(re2, mut)
                nlpData[rsId] = {
                    "mut": mut,
                    "ref": split[1],
                    "pos": split[2],
                    "alt": split[3],
                    "disease": mut + ' in: ' + ', '.join(diseases)
                }
                rsIds.append(rsId)

            pmSourceUrl = 'https://www.ncbi.nlm.nih.gov/research/bionlp/litvar/api/v1/public/rsids2pmids'
            body = json.dumps({"rsids": rsIds})
            headers['content-type'] = "application/json"
            sourceReq = requests.post(pmSourceUrl, headers=headers, data=body, timeout=0.5)

            if sourceReq.status_code == 200:
                sources = sourceReq.json()
                for x in sources:
                    pmurl = 'https://pubmed.ncbi.nlm.nih.gov/?term={0}%5Buid%5D/'.format('%2C'.join([str(item) for item in x['pmids']]))
                    nlpData[x['rsid']]['pmid'] = pmurl

            data['litvar'] = nlpData

        return jsonify(JSONEncoder().encode(data))

    
    '''
    Returns a single annotation field for the specified uniprot id
    '''
    @app.route('{0}/fetch_track'.format(dev_route), methods=['POST'])
    def load_track():
        req_json = request.get_json()
        uniprot_id = req_json['uniprotId']
        track = req_json['track']

        query_dict = {}
        query_dict[track] = 1

        db_query = {"uniprot_id": uniprot_id}

        client = MongoClient(DB_HOST, DB_PORT)
        db = client[DB_NAME]
        coll = db[COLLECTION_NAME]
        data = list(coll.find(db_query, query_dict))

        if len(data) > 0:
            data = data[0]
        else:
            return jsonify(JSONEncoder().encode({"Message": "Not found"})), 400

        return jsonify(JSONEncoder().encode(data))

    @app.errorhandler(Exception)
    def handle_bad_request(e):
        print(traceback.format_exc())
        return 'Error', 500

    return app
