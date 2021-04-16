require(seqinr)
require(Biostrings)
require(IRanges)
require(foreach)
require(doParallel)
require(jsonlite)
require(msa)
require(tidyverse)
require(mongolite)

source('utils.R')
source("gather_load_data.R")
source("annotate_transcript.R")

### -------------------------------------------------------------
# Gather data for the annotations
dat <- gather_load_data()
protein_transcripts <- dat$protein_transcripts
to_ann <- protein_transcripts

### -------------------------------------------------------------
# Run and store the annotations

transcript_mongo <- mongo(collection = "transcripts", db = "p2t2", url = "mongodb://localhost",
      verbose = FALSE, options = ssl_options())

#Need a separate connection for the model collection since it stores blobs
file_mongo <- gridfs(db = "p2t2", prefix = "fs")

#filter transcripts that have already been annotated
extant <- transcript_mongo$find(query = '{}', fields = '{"enst": "true"}')
extant <- extant$enst
to_ann <- to_ann[!to_ann$enst %in% extant, ]

registerDoParallel(cores = max(detectCores() - 2, 1))

out <- foreach(curr_transcript = unique(to_ann$enst)) %dopar% {
    tryCatch(
        {
            annotation_json <- annotate_transcript(curr_transcript, to_ann, dat, c("seq", "canonical_isoform", "uniprot_info", "numAA", "gene_symbol", "ensembl_gene_symbol", "uniprot_id", "enst", "ensp", "clinvar", "hgmd","ips", "swissprot", "isoform_msa", "paralog_msa"))
            cat(curr_transcript, " done. \n")

            test <- transcript_mongo$insert(toJSON(annotation_json, auto_unbox = TRUE))
            if (test$nInserted < 1){
                stop("Not inserted")
            }
        }, error = function(e) {
            print(e)
            fileConn <- file(paste0("errors/", curr_transcript, ".txt"))
            writeLines(curr_transcript, fileConn)
            close(fileConn)
        }, warning = function(w) {
            print(w)
        }
    )
}
