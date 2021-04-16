suppressMessages(require(tidyverse))
suppressMessages(require(foreach))
suppressMessages(require(doParallel))
suppressMessages(require(jsonlite))

path <- "/home/edevoe/p2t2/data_load/"
source(paste0(path, 'utils.R'))
source(paste0(path, "gather_load_data.R"))
source(paste0(path, "annotate_transcript.R"))

args <- commandArgs(TRUE)
if (length(args) == 0){
    #Supply default values
    update_cols = "ALL"
} else {
    for (i in 1:length(args)){
        eval(parse(text = args[[i]]))
    }
}

if (!("pdb" %in% update_cols)){
    dat <- gather_load_data(update_cols)
} else {
    dat <- gather_load_data("")
}

run_list <- dat$protein_transcripts

update_func <- function(curr_transcript, run_list, dat, update_cols){
    tryCatch(
        {
            all_annots <- annotate_transcript(curr_transcript, run_list, dat, update_cols)
            
            if (length(all_annots) > 0){
                return(all_annots)
            } else {
                print(paste0(curr_transcript, " had no annotations."))
                return(FALSE)
            }
        }, error = function(e) {
            print(paste0(curr_transcript, " failed."))
            return(FALSE)
        })
}

registerDoParallel(cores = max(detectCores() - 1, 1))
out <- foreach(curr_transcript = run_list$enst) %dopar% {
	curr_out <- update_func(curr_transcript, run_list, dat, update_cols)
	return(curr_out)
}

stopImplicitCluster()
out_file <- "update.Rda"

print(head(out))
out <- list(ids = run_list$enst, annotations = out)
save(out, file = out_file)
