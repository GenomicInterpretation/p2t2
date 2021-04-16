#!/bin/bash
arr_out=$(qsub run_update.pbs | cut -d '.' -f 1)
qsub -W depend=afterokarray:$arr_out consolidate.pbs
