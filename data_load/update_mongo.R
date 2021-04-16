require(jsonlite)
require(tidyverse)
require(mongolite)
#require(doParallel)
require(foreach)

load("update.Rda")

transcript_mongo <- mongo(collection = "transcripts", db = "p2t2", url = "mongodb://localhost",
      verbose = FALSE, options = ssl_options())

#registerDoParallel(cores = max(detectCores() - 1, 1))
mongoout <- foreach(i = 1:length(out$annotations)) %do% {
    curr_transcript <- out$ids[[i]]
    curr_ann <- out$annotations[[i]]
    
    if (!is.null(curr_ann) && !is.logical(curr_ann) ){
        tryCatch(
            {
                curr_ann <- toJSON(curr_ann, auto_unbox = TRUE)
                test <- transcript_mongo$update(stringr::str_interp('{"enst" : "${curr_transcript}"}'), stringr::str_interp('{"$set": ${curr_ann}}'))

                if (test$modifiedCount < 1){
                    if (test$matchedCount < 1){
                        stop("Not inserted: Problem with new data.")
                    }
                    stop("Not inserted: No change.")
                } else {
                    print(stringr::str_interp("${curr_transcript} done."))
                }
            }, error = function(e) {
                print(e)
                fileConn <- file(paste0("errors/", curr_transcript, ".txt"))
                writeLines(e, fileConn)
                close(fileConn)
            }, warning = function(w) {
                print(paste0("warning: ", w, " for transcript: ", curr_transcript))
            }
        )
    } else {
        print(stringr::str_interp("${curr_transcript} had no annotations"))
        return(curr_transcript)
    }
}

#stopImplicitCluster()