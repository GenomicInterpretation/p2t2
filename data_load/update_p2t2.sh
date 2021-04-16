#!/bin/bash

#Author: Elias DeVoe
#Description: Automate P2T2 data loading and updates

#Print help info on command line
function call_help {
        echo -e "Example usage: update_p2t2.sh isoform_msa"
        echo "Options:"
        echo "-a All      Update all columns"
        exit 1
}

#Read command line
while getopts c:a o
do
        case $o in
        a)      columns="$OPTARG";;
        esac
done
shift $(($OPTIND - 1))

# Print help if no input provided
if [ $# -eq 0 ]
then
        echo -e "No input provided.\n"
        call_help
fi

par_columns=''
for input in $*
do
    par_columns=$par_columns,\'$input\'
done

#Trim off leading ,
par_columns=${par_columns#*,}

#For non-MSA columns, use R parallel with multiple nodes
if [ ${#par_columns} -gt 0 ]
then

qsub << EOF
#PBS -N par_update_p2t2
#PBS -m bae
#PBS -l nodes=1:ppn=24
#PBS -l mem=50GB
#PBS -l walltime=3:00:00:00
#PBS -j oe
cd \$PBS_O_WORKDIR
module load gcc R
R CMD BATCH --no-save --no-restore "--args update_cols=c($par_columns)" update_p2t2.R par.log.rout
EOF

#Show that the job is queued
qstat -u `whoami`

fi