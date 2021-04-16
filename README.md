# P2T2
Protein Panoramic annoTation Tool: an interactive web-based tool designed to assist in the interpretation of protein coding variants by presenting multiple annotation and data types in a unified view.

# Using Our Online Hosted Version
Currently, a version of P2T2 is hosted at: https://p2t2.ctsi.mcw.edu/

The advantage of our hosted tool is that it is installation-free and accessible for research!

The disadvantage, is that we do not currently have data upload options - those options are in development. If you have track data that you want to add, please see the section below for installing and populating your own version, which you can customize (subject to LICENSE.txt).


# Installation
Requires Docker (https://www.docker.com/products/docker-desktop)

## Basic Use
```
git clone https://github.com/GenomicInterpretation/p2t2.git
cd p2t2
docker-compose up
```
P2T2 should be available at localhost:8080 in a browser, with isoforms of KRAS (P01116 and P01116-2) available.

A larger (1.9GB) dataset, containing header information for the proteome (id[uniprot, enst, ensp, gene_symbol], sequence) as well as tracks for isoform and paralog MSA, gnomAD, and ClinVar, is available here:
https://mcw.box.com/shared/static/mlbxua630desnj1udhrac2vpkfqimprp.json

The downloaded file should be named p2t2_basic.json, and placed under mongo-seed/p2t2, at the same level as kras.json. The first time Docker is started after adding data, use `docker-compose up --build`, which can take ~5 minutes. After the initial build, docker can be started normally.

## Updating data
Data should be updated using a parallel cluster or other multi-core setup. Under data_load/ Use `bash update_p2t2.sh colname1 colname2 ...` adding column names as needed (annotate_transcript.R should have an exhaustive list), or `bash update_p2t2.sh all`.
Updates will be saved in update.Rda. Use update_mongo.R to update the Mongo Database with this output file.

## Javascript
The frontend is bundled to frontend/bundle.js.
Install npm packages under frontend. There are copies of node_modules at the top level and in frontend. If you need to reset package.json/node_modules, make sure to remove both. Docker copies node_modules from frontend on start, and changes will not be recognized unless both are removed.

## LICENSE
Please see LICENSE.txt in this repository.
