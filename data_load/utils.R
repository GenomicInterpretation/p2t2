suppressMessages(require(igraph))
suppressMessages(require(magrittr))
suppressMessages(require(bio3d))
suppressMessages(require(jsonlite))
suppressMessages(require(stringr))
suppressMessages(require(seqinr))

## The update_cols parameter can be used to select which annotations to get, in order to save
# 	compute time if updates to certain fields need to be made

DEFAULT_COLS = c("seq", 
                 "canonical_isoform", 
                 "uniprot_info", 
                 "numAA",
                 "gene_symbol", 
                 "ensembl_gene_symbol", 
                 "uniprot_id", 
                 "enst", 
                 "ensp", 
                 "ccds", 
                 "gnomad", 
                 "clinvar", 
                 "hgmd", 
                 "ptm",
                 "psp", 
                 "ips", 
                 "elm", 
                 "swissprot",
                 "pdb",
                 "isoform_msa",
                 "paralog_msa")

make.frame <- function( frame.names='V1', classes='c' ){

    cj <- factor( strsplit( classes, '' )[[1]],
                    levels = strsplit('cndil','')[[1]],
                    labels = c('character','numeric','double','integer','logical') )

    d <- data.frame( array( '', dim = c( 0, length(frame.names) )) )
    names(d) <- frame.names
    for (i in 1:length(frame.names)){
        class(d[[i]]) <- as.character(cj[i])
    }

    return(d)
}

#' list_nextprot_types
#' 
#' This function returns the types that can be requested from get_data_from_nextprot()
list_nextprot_types <- function(){
    ty <- c('SLIM','variant','sites','sequence')
    return(ty)
}

#' get_data_from_nextprot
#'
#'This function uses the neXtProt API system to retrive UniProt data.
#'For more information: https://api.nextprot.org
#'
#' @param uniprot_acc [NULL] UniProt accession number
#' @param type ['SLIM'] (simple linear motifs and domains), 'variant'
#' @param isoform [1]
#'
#' @return data.frame with the requested data
#' @export
#'
get_data_from_nextprot <- function( uniprot_acc = NULL, type = "SLIM", isoform = 1 ){
    if (all(is.null(uniprot_acc))){
        stop('No UniProt accession given. An example would be BRAF which has accession P15056')
    }

    outJSON <- sprintf('https://api.nextprot.org/entry/NX_%s', uniprot_acc)

    if (length(outJSON) == 0){
        stop(paste0("No JSON was found for Uniprot Accession: ", uniprot_acc, ". Stopping."))
    }
    
    annot <- fromJSON(outJSON)
    if (length(type) > 1){
        out <- list()
    }

    valid_types <- list_nextprot_types()
    isoform <- paste0("NX_", uniprot_acc, "-", isoform)
    for (ty in type){
        if (ty == 'SLIM'){
        
            i <- grep('topolog|domain|region|motif|signal-peptide',
                        names(annot$entry$annotationsByCategory), ignore.case = TRUE, perl = TRUE )
            
            org <- make.frame( c('description', 'category', 'start', 'stop'), 'ccnn' )
            for (j in i){
                m <- annot$entry$annotationsByCategory[[j]]$targetingIsoformsMap[[isoform]]
                if (!is.null(dim(m))){
                    a <- annot$entry$annotationsByCategory[[j]][ , c('description','category','annotationId') ]
                    annotation_row <- merge( m, a, by = 'annotationId' )[ , c('description','category','firstPosition','lastPosition') ]
                    
                    org <- rbind( org, annotation_row )
                }
            }
            
            names(org) <- c('description', 'category', 'start', 'stop')
            
            if (any( is.na(org$start) | is.na(org$stop) )){
                org <- org[ ! (is.na(org$start) | is.na(org$stop) ), ]
            }
            
            if (length(type) > 1 && !is.null(org)){
                out[[ty]] <- org
            } else {
                out <- org
            }
        
        } else if (ty == 'sites'){
        
            i <- grep('catalytic-activity|active-site|modified-residue|binding-site|cleavage-site|cross-link|glycosylation-site|lipidation-site|metal-binding-site',
                        names(annot$entry$annotationsByCategory), ignore.case = TRUE, perl = TRUE )
            
            org <- make.frame( c('description', 'category', 'start', 'stop'), 'ccnn' )
            for (j in i){
                
                m <- annot$entry$annotationsByCategory[[j]]$targetingIsoformsMap[[isoform]]
                if (!is.null(dim(m))){
                    
                    a <- annot$entry$annotationsByCategory[[j]][ , c('description','category','annotationId') ]

                    annotation_row <- merge( m, a, by = 'annotationId' )[ , c('description','category','firstPosition','lastPosition') ]
                    
                    org <- rbind( org, annotation_row )
                }
            }
            
            names(org) <- c('description', 'category', 'start', 'stop')
            
            if (any( is.na(org$start) | is.na(org$stop) )){
                org <- org[ ! (is.na(org$start) | is.na(org$stop) ), ]
            }
            
            if (length(type) > 1 && !is.null(org)){
                out[[ty]] <- org
            } else {
                out <- org
            }

        } else if (ty == 'variants'){
        
            i <- grep('variant|mutagenesis', names(annot$entry$annotationsByCategory), ignore.case = TRUE, perl = TRUE )
 
            if ( length(i) == 0 ){
                org <- NULL
            } else {
                
                org <- make.frame( c('ref', 'start', 'stop', 'alt', 'descripion', 'disease'), 'cnnccc' )
                tmp <- list()
                
                for (j in i){
                    v   <- annot$entry$annotationsByCategory[[j]]
                    tmp <- c(tmp, lapply( 1:dim(v$propertiesMap)[1], function(x){
                        
                        if ( all(is.na(v$variant)) || all(is.null(dim(v$variant))) ){return(NULL)}
                        curr_iso <- v$targetingIsoformsMap[[isoform]]
                        if (!is.null(curr_iso)){
                            this_var <- data.frame( ref   = v$variant[x,"original"],
                                                    start = curr_iso[ x, "firstPosition"],
                                                    stop  = curr_iso[ x, "lastPosition"],
                                                    alt   = v$variant[x,"variant"],
                                                    description = v$variant[x, "description"],
                                                    category = v$category[x]
                                                )
                        
                            if ( (!is.null( dim(v$properties[[x]]))) &&
                                ("name" %in% colnames(v$properties[[x]])) &&
                                ("disease" %in% v$properties[[x]]$name) ){
                                d <- v$properties[[x]]$value[ v$properties[[x]]$name == "disease" ] %>%
                                    sort(.) %>% unique(.) %>% paste(., sep = "|", collapse = "|")
                                this_var$disease <- d
                            } else {
                                this_var$disease <- ""
                            }
                            return(this_var)
                        }
                    }))
                }
                org <- do.call( rbind, tmp )
                if ("start" %in% names(org)){
                    org$description <- as.character(org$description)
                    org <- org[ order(org$start, org$ref, org$stop, org$alt), ]
                    org$description[ is.na(org$description) ] <- ""
                }
            }
            
            if (length(type) > 1 && !is.null(org)){
                out[[ty]] <- org
            } else {
                out <- org
            }
        
        } else {
            stop(sprintf('The "type" %s was not recognized. Supported types include: %s',
                    type, paste(valid_types, sep=', ', collapse = ', ') ))
        }
    }

    return(out)
}

# specifically intended for CAVA, but should generally work
parseAA <- function(data){ 

    col <- grep( 'CSN', names(data) )
    if (length(col) > 1){
        col <- col[ grep('CAVA',col,ignore.case=TRUE) ]
    }
    if (length(col) == 0){ stop('No CSN column found') }

    data$CAVA_AA_Change <- sapply( data[[ names(data)[col] ]], function(x){
        x <- gsub( 'extX[0-9]+', '', x )
        sub( '.+p[.]', '', getElement(strsplit(x,':')[[1]],1), perl=TRUE )
    })

    data$CAVA_AA_Pos    <- sapply( data$CAVA_AA_Change, function(x){
        gsub('\\D','',  strsplit(x, '_')[[1]][1]  )
    })

    return(data)
}

## https://github.com/jeroenooms/jsonlite/issues/73
toJSON2 <- function(x, dataframe = "rows", null = "null", na = "string",
    auto_unbox = TRUE, use_signif = TRUE, force = TRUE, rownames = FALSE,
    POSIXt = "epoch", keep_vec_names = TRUE, ...) {

    jsonlite::toJSON(I(x), dataframe = dataframe, null = null, na = na,
        auto_unbox = auto_unbox, use_signif = use_signif, force = force,
        rownames = rownames, POSIXt = POSIXt, keep_vec_names = keep_vec_names, ...)
}

read_up_file <- function(fn){
    up <- seqinr::read.fasta(fn, as.string = TRUE, seqtype = "AA")
    names(up) <- names(up) %>% strsplit(., "|", fixed = TRUE) %>% sapply(`[`, 2)
    up <-  up %>% sapply(`[`, 1)
    up <- data.frame(uniprot_id = names(up), seq = up[names(up)], row.names = NULL, stringsAsFactors = FALSE)
    return(up)
}

jaggedToDF <- function(l){
    out <- data.frame(matrix(unlist(l), ncol=length(l)))
    names(out) <- names(l)
    return(out)
}

remove_header_comment <- function(tmp_names){
    #Header line is commented with '## ' so they'll be prepended to the first name. Remove them:

    tmp_names[[1]] <- gsub("#", "", tmp_names[[1]])
    tmp_names[[1]] <- gsub(" ", "", tmp_names[[1]])

    return(tmp_names)
}

read_bior_catalog_file <- function(fn){
    out <- read_tsv(fn)
    names(out) <- gsub("#UNKNOWN_7.", "", toupper(names(out)))
    out <- out[, names(out) != "SAMPLES"] %>% as.data.frame()
    return(out)
}

cat_cols <- list(
    clinvar = c('CAVA_PROTPOS', 'CAVA_TRANSCRIPT', 'CAVA_CSN', 'CAVA_PROTREF', 'CAVA_PROTALT', 'CLINICAL_SIGNIFICANCE', 'REVIEW_STATUS', 'ALL_TRAITS' ),
    hgmd = c('CAVA_PROTPOS', 'CAVA_TRANSCRIPT', 'CAVA_PROTREF', 'CAVA_CSN', 'PROT', 'CLASS', 'PHEN'),
    gnomad = c('CAVA_PROTPOS', 'CAVA_TRANSCRIPT', 'CAVA_PROTREF', 'CAVA_PROTALT', 'CAVA_CSN', 'AF', 'AC', 'AN', 'MQ')
)

jsonify_bior_cat <- function(df, curr_transcript, cat_name){
    these.names <- cat_cols[[cat_name]]
    curr <- df %>% filter(stringr::str_detect(CAVA_TRANSCRIPT, curr_transcript)) %>% dplyr::select(these.names)

    if (dim(curr)[[1]] > 0){
        #Rows match multiple transcripts, with data for each column seperated by ':' characters.
        out <- curr %>% apply(1, function(row){
            #Get the index of this transcript in CAVA columns
            index <- match(curr_transcript, strsplit(row[['CAVA_TRANSCRIPT']], ":") %>% unlist())

            new_row <- names(row) %>% lapply(function(name){
                
                if (str_detect(name, "CAVA_")){
                    #Return the value at the correct index
                    all_vals <- strsplit(row[[name]], ":") %>% unlist()
                    if (length(all_vals) >= index){
                        return(all_vals[[index]])
                    }
                    return(NULL)
                }
                return(row[[name]])
            }) %>% as.vector()
        }) %>% do.call("rbind", .) %>% as.data.frame()

        names(out) <- names(curr)
        #Filter out variants that were not mapped to a protein position
        out <- out %>% filter(CAVA_PROTPOS != ".")

        if (dim(out)[[1]] == 0){
            return(NULL)
        }
        #Transcript ID should only be stored once in JSON
        #CAVA will match each isoform for each variant - there will be many duplicate rows
        out <- out[!duplicated(out), ]
        out$AA_LEN <- nchar(out$CAVA_PROTREF)
        out <- out[, !names(out) %in% c("CAVA_TRANSCRIPT")]
        return(out)
    }
    return(NULL)
}

make_msa_json <- function(sequences, curr_transcript){
        out.fasta <- paste0(curr_transcript, '.tmp.fasta')
        seqinr::write.fasta(sequences = as.list(sequences), names = names(sequences), file.out = out.fasta)
        ma <- as.character(msaClustalW(out.fasta, order="input", type = "protein"))
        names(ma) <- names(sequences)
        file.remove(out.fasta, str_interp("${curr_transcript}.tmp.aln"), str_interp("${curr_transcript}.tmp.dnd"))
        outJSON <- names(ma) %>% lapply(function(isoform_uniprot_id){
                seq <- ma[[isoform_uniprot_id]]
              list(ID = isoform_uniprot_id, Seq = seq)
         })
         
         return(toJSON(outJSON))
}

make_paralog_msa_json <- function(sequences, curr_transcript){
	ma <- as.character(msa(sequences, type = "protein"))
	outJSON <- names(ma) %>% lapply(function(curr_id){
		seq <- ma[[curr_id]]
		list(ID = curr_id, Seq = seq)
	})
	
	return(toJSON(outJSON))
}

#Create a fasta for each core to run on
#Try to distribute total number of amino acids in each directory equally,
#so the runs take about the same time
#Also sort sequences individually so required space is known ahead of time
setup_multicore_fasta <- function(input_df, seq_col = "seq", id_col = "uniprot_id", n_cores = 100, fasta_dir = "fastas/"){
    if (!dir.exists(fasta_dir)){
        system(stringr::str_interp("mkdir ${fasta_dir}"))
    }
    input_df <- input_df[order(nchar(input_df[[seq_col]])), ]
    total_seqlen <- sum(nchar(input_df[[seq_col]]))
    aa_per <- total_seqlen / n_cores
    aa_tot <- 0
    file_num <- 1
    prev_index <- 1
    curr_index <- 1

    for(index in 1:nrow(input_df)){
        curr <- input_df[index, ]
        curr_seqlen <- nchar(curr[[seq_col]])
        aa_tot <<- aa_tot + curr_seqlen
        if (aa_tot >= aa_per || index == nrow(input_df)){

            #If the current protein exceeded the limit per file, reset the count and start a new file
            aa_tot <<- 0
            file_num <<- file_num + 1

            #Add the longest sequence length to the filename to determine memory size
            fn <- paste0(fasta_dir, str_interp("${file_num}.${curr_seqlen}.fasta"))
            
            write.fasta(sequences = strsplit(input_df[[seq_col]][prev_index:curr_index], ""), 
                    names = input_df[[id_col]][prev_index:curr_index],
                    file.out = fn)

            #Get all sequences between the previous reset and this one
            prev_index <<- curr_index
        }
        curr_index <<- curr_index + 1
    }
}

bior_catalogs = list(clinvar = "ClinVar/201805_GRCh38/variants.v1/macarthur-lab_xml.tsv.bgz",
    hgmd = "HGMD/2018.1_GRCh38/variants.v1/HGMD_PRO.vcf.tsv.bgz",
    gnomad = "gnomAD/r2.0.2_GRCh38/variants.v1/gnomAD.tsv.bgz"
)

catalog_dir <- "/rcc/stor1/depts/gspmc/BDAU/catalogs/"
cava_dir <- "/rcc/stor1/depts/gspmc/BDAU/software"

cava_cols <- c('CAVA_GENE', 'CAVA_TRANSCRIPT', 'CAVA_GENEID', 'CAVA_PROTPOS', 'CAVA_PROTREF',
                'CAVA_PROTALT', 'CAVA_CLASS', 'CAVA_SO', 'CAVA_IMPACT', 'CAVA_ALTANN', 
                'CAVA_ALTCLASS', 'CAVA_ALTSO', 'CAVA_CSN')

#Drill out desired columns so the data can be read into data.frames
bior_annotate_path <- "/rcc/stor1/depts/gspmc/BDAU/software/bior_annotate"

## prepend #UNKNOWN_7 to all non-CAVA columns for drilling
drills <- list(clinvar = c('clinical_significance','review_status','all_traits'),
                hgmd = c('MUT','PROT','CLASS','PHEN'),
                gnomad = c('AF', 'AC', 'AN', 'MQ')) %>% lapply(function(x){
                    return(paste("#UNKNOWN_7.", x, sep = ""))
                })

## @param fn: sorted bedfile to overlap
#  @param catalogs: list of bior catalogs from which to retrieve annotations
bed2anno <- function(fn, catalogs){

    #Match annotations to their transcripts using the bior catalogs for HGMD, ClinVar, gnomAD
    #Run CAVA to get the protein coding effect in each variant for each nucleotide change
    for(curr_name in catalogs){
        if (!curr_name %in% names(bior_catalogs)){
            next
        }

        catalog <- paste0(catalog_dir, bior_catalogs[[curr_name]])
        cava_out <- paste(fn, curr_name, "cava_final", sep = "_")
        curr_drills <- paste(c(cava_cols, drills[[curr_name]]), collapse= ",")
        final_vcf_name <- paste(fn, curr_name, "drilled.vcf", sep = "_")

        #bedtools intersect is equivalent to intersectBED. Using -wb reads the match from file -b
        #However, the information from -a is kept, thus INFO must be read from the fourth column
        #bior_tjson_to_vcf reads info from the column specified with -c. -j keeps INFO output.

        if (!dir.exists(curr_name)){
            system(str_interp("mkdir ${curr_name}"))
        }
        
        setwd(paste0("./", curr_name))
        fileConn <- file(str_interp("${fn}_${curr_name}_sub.pbs"))
        mem <- "6GB"
        walltime <- "8:00:00"
        queue <- "#PBS -q bigmem"
        if (curr_name == "gnomad"){
            mem <- "20GB"
            walltime <- "3:00:00:00"
        }
        #Make RCC job submission files for each db
        writeLines(
            c(str_interp("#PBS -N ${fn}_${curr_name}_sub"),
                "#PBS -m bae",
                "#PBS -l nodes=1:ppn=1",
                str_interp("#PBS -l mem=${mem}"),
                str_interp("#PBS -l walltime=${walltime}"),
                "#PBS -j oe",
                queue,
                "",
                "cd $PBS_O_WORKDIR",
                "module load bior bedtools2/2.25.0",
                ". /rcc/stor1/depts/gspmc/BDAU/bt.sh",
                str_interp("bedtools intersect -a ../${fn} -b ${catalog} -wb -sorted | cat > ${fn}_pretmp.tjson"),
                'echo "Bedtools intersect done."',
                str_interp('cat ${fn}_pretmp.tjson | bior_tjson_to_vcf -j > ${fn}_tmp.vcf'),
                'echo "bior tjson to vcf done"',
                str_interp("head -n 700 ${fn}_tmp.vcf | grep -P '^#' | cat > ${fn}_tmp_filtered.vcf"),
                str_interp('headCount=$((`wc -l < ${fn}_tmp_filtered.vcf` + 1))'),
                str_interp('tail -n +$headCount ${fn}_tmp.vcf > ${fn}_tmp_nohead.vcf'),
                str_interp("awk 'NR=1{if (substr($4, 1, 1) == substr($5, 1, 1))  print > \"${fn}_errors.vcf\"; else print > \"${fn}_tmp_body.vcf\" }' < ${fn}_tmp_nohead.vcf"),
                str_interp("cat ${fn}_tmp_body.vcf >> ${fn}_tmp_filtered.vcf"),
                "echo \"Error processing done\"",
                str_interp("${cava_dir}/CAVA/cava -c ../p2t2_cava_conf.conf -i ${fn}_tmp_filtered.vcf -o ${cava_out}"),
                str_interp(c(
                    "perl ${bior_annotate_path}/trunk/scripts/Info_extract2.pl ${cava_out}.vcf -q ${curr_drills}",
                    " | grep -Pv '^##' | sed 's/^#//' | cat > ${final_vcf_name}")),
                str_interp("bgzip ${final_vcf_name}")),
            fileConn)
        close(fileConn)

        #Submit the job (Final output will be ${curr_name}_drilled.vcf)
        system(str_interp("qsub ${fn}_${curr_name}_sub.pbs"))
        setwd("..")
    }
}
get_top_models <- function(pdbs, seqlen){
    pdbs$col <- 'orangered'
    pdbs$col[ (pdbs$Identity >= 40) | (pdbs$Positive >= 60 ) ] <- 'gold'
    pdbs$col[ (pdbs$Identity >= 70) | (pdbs$Positive >= 75 ) ] <- '#83c9a6' ; # light teal  #'#469F72' ;#'green'
    pdbs$col[ (pdbs$Identity >= 95) | (pdbs$Positive >= 97 ) ] <- '#007A00' ; #'darkgreen'
    
    PDBCount <- sprintf('%d High, %d Medium, and %d Low',
                    sum(pdbs$col %in% c('green','darkgreen')),
                    sum(pdbs$col == 'gold'),
                    sum(pdbs$col == 'red') )
    
    ir <- IRanges( as.numeric(pdbs$QueryStart), width = as.numeric(pdbs$QueryEnd) - as.numeric(pdbs$QueryStart) )
    qs <- round( c(seq( 1, seqlen, seqlen/49 ), seqlen)) # look in 50 locations across the gene - present info across the gene
    k <- numeric(0)
    for (qi in qs){
        q  <- IRanges( qi, width = 1 )
        k5 <- findOverlaps( q, ir, maxgap = max(5, round(seqlen/100)) ) # PDBs within ? AA of this "q" mark
        if ( ('subjectHits' %in% names(k5)) && (length(k5@subjectHits) >= 1) ){
            
            ## Take the best hit within the window
            i <- pdbs$Identity[ k5@subjectHits ]
            k <- c(k, k5@subjectHits[ which(i==max(i))[1] ] )
            
        } else {
            
            ## or the nearest one, if nothing in the window
            k <- c(k, nearest( q, ir ) )
            
        }
    }
    k <- sort(unique(k))
    
    ## If k is short (few hits across the protein), fill it in with the next highest identity hits, up to 10
    if ( length(k) < 10 ){
        k <- c(k, setdiff( order(pdbs$Identity, decreasing = TRUE), k )[ 1 : (10 - length(k)) ] )
    }
    
    return(list(PDB = pdb[ k, ], PDBCount = PDBCount))
}

"/apps/shared/R/4.0.1/lib64/R/library/tidyverse"
