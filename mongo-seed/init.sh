#!/bin/bash

if [ -f "p2t2/p2t2_basic.json" ]; then
    mongoimport --host mongo --db p2t2 --collection transcripts p2t2/p2t2_basic.json --stopOnError
    mv p2t2/p2t2_basic.json p2t2/p2t2_basic.used.json
fi
if [ -f "p2t2/kras.json" ]; then
    mongoimport --host mongo --mode=merge --db p2t2 --collection transcripts p2t2/kras.json --stopOnError
    mv p2t2/kras.json p2t2/kras.used.json
fi