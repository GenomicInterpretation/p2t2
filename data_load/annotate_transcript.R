suppressMessages(library(dplyr))
suppressMessages(library(IRanges))
suppressMessages(library(msa))
suppressMessages(library(jsonlite))
suppressMessages(library(stringr))

path <- "/home/edevoe/p2t2/data_load/"
source(paste0(path, 'utils.R'))

col2 <- c('darkgreen', 'turquoise', 'purple', 'lightblue', 'black')
## The update_cols parameter can be used to select which annotations to get, in order to save
# 	compute time if updates to certain fields need to be made

annotate_transcript <- function(curr_transcript, protein_transcripts, dat, update_cols = DEFAULT_COLS){
	if (update_cols == "ALL"){
		update_cols = DEFAULT_COLS
	}

	#All data for current transcript
	curr_dat <- protein_transcripts[protein_transcripts$enst == curr_transcript, ][1, ]
	curr_symbol <- curr_dat$gene_symbol
  
	print(paste0( 'Running ',  curr_transcript))

	json_data <- list()
	if ("seq" %in% update_cols){
		json_data$seq <- curr_dat$seq
	}
	
	id_info <- str_split(curr_dat$uniprot_id, "-")
	unversioned_id <- id_info[[1]][[1]]
	version <- 1

	if (length(id_info[[1]]) > 1){
		version <- as.numeric(id_info[[1]][[2]])
	}
	
	canonical_isoform <- FALSE
	if (version == 1){
		canonical_isoform <- TRUE
	}
	if ("canonical_isoform" %in% update_cols){
		json_data$canonical_isoform <- canonical_isoform
	}
	
	if ("uniprot_info" %in% update_cols){
		uniprot_info <- tryCatch(
			{
				get_data_from_nextprot(uniprot_acc = unversioned_id, type = c('SLIM', 'sites', 'variants'), isoform = version)
			},
			error = function(err){
				print(err)
				return(NA)
			}
		)
	} else if ( "ips" %in% update_cols){
		uniprot_info <- tryCatch(
			{
				get_data_from_nextprot(uniprot_acc = unversioned_id, type = c('SLIM', "sites", "variants"), isoform = version)
			},
			error = function(err){
				print(err)
				return(NA)
			}
		)
	}
	
	seqlen <- nchar(curr_dat$seq)
	xi <- 1:seqlen

	if ("numAA" %in% update_cols){
		json_data$numAA <- seqlen
	}
	

	## -----------------------------------------------------------------
	## Record IDs used
	if ("gene_symbol" %in% update_cols){
		json_data$gene_symbol <- curr_dat$gene_symbol
	}
	if ("ensembl_gene_symbol" %in% update_cols){
		json_data$ensembl_gene_symbol <- curr_dat$ensembl_gene_symbol
	}
	if ("uniprot_id" %in% update_cols){
		json_data$uniprot_id <- curr_dat$uniprot_id
	}
	if ("ensp" %in% update_cols){
		json_data$ensp <- curr_dat$ensp
	}
	if ("enst" %in% update_cols){
		json_data$enst <- curr_dat$enst
	}
	

	## ---------------------------------------------------------------
	## Exon structure

	#If this is the canonical isoform, it won't have a version
	#CCDS does, so append -1 to match this isoform

	if ("ccds" %in% update_cols){
		versioned_id <- curr_dat$uniprot_id
		if (!str_detect(versioned_id, "-")){
			versioned_id <- paste0(versioned_id, "-1")
		}
		curr_ccds <-dat$ccds %>% filter(UniProtKB == versioned_id)
		
		if (dim(curr_ccds)[1] > 0){
			json_data$CCDS_ID <- curr_ccds$ccds_id[[1]]
			json_data$CCDS <- curr_ccds
		}
	}

	## -----------------------------------------------------------------
	if ("gnomad" %in% update_cols){
		json_data$gnomad <- jsonify_bior_cat(dat$gnomad, curr_transcript, "gnomad")
	}
	## -----------------------------------------------------------------
	if ("hgmd" %in% update_cols){
		tmp_hgmd <- dat$hgmd %>% filter((dat$hgmd$MUT != 'REF' ) & (!(hgmd$CLASS == 'R')) & (!is.na(dat$hgmd$CAVA_PROTPOS)))
		json_data$HGMD <- jsonify_bior_cat(tmp_hgmd, curr_transcript, "hgmd")
	}
	## -----------------------------------------------------------------
	if ("clinvar" %in% update_cols){
		clinvar_pathog <- dat$clinvar$clinvar_pathog
		clinvar_benign <- dat$clinvar$clinvar_benign
		clinvar_other <- dat$clinvar$clinvar_other

		json_data$ClinVar_Patho <- jsonify_bior_cat(clinvar_pathog, curr_transcript, "clinvar")
		json_data$ClinVar_Other <- jsonify_bior_cat(clinvar_other, curr_transcript, "clinvar")
		json_data$ClinVar_Benign <- jsonify_bior_cat(clinvar_benign, curr_transcript, "clinvar")
	}
	## -----------------------------------------------------------------
	## PTMs
	if ("ptm" %in% update_cols){
	
		this.ptm <- dat$ptm %>% filter(ensp == curr_dat$ensp)

		if (dim(this.ptm)[1] > 0){
			this.ptm$pos <- as.numeric(gsub('\\D', '', this.ptm$Residue1))
			this.ptm$col <- 'gray'
			si <- 0
			for (ss in c('phospho', 'ubiquitin', 'acetyl', 'glycosyl', 'methyl')){
				si <- si + 1
				hit <- grepl(ss, this.ptm$PTM1)
				if (any(hit)){
					this.ptm$col[hit] <- col2[si]
				}
			}

			xj <- this.ptm$pos %in% xi
			if (any(xj)){
				these.names <- c('pos', 'Residue1', 'PTM1', 'col')
				json_data$PTMCode2 <- this.ptm[xj, these.names]
			}

		}
	}
	
	## -----------------------------------------------------------------
	## PSP
	if ("psp" %in% update_cols){
		this.psp <- dat$psp %>% filter(ACC_ID == curr_dat$uniprot_id)

		if( dim(this.psp)[1] > 0 ){
			this.psp$AA   <- sapply( this.psp$MOD_RSD, function(x){ (strsplit(x,'-')[[1]])[1] } )
			this.psp$pos  <- sapply( this.psp$AA , function(x){ as.numeric(gsub( '\\D', '', x ))} )
			this.psp$type <- sapply( this.psp$MOD_RSD, function(x){ (strsplit(x,'-')[[1]])[2] } )
			this.psp$col <- 'gray'
			si <- 0
			for ( ss in c('p','ub','ac','ga','m[123e]' ) ){
				si <- si + 1
				hit <- grepl( ss, this.psp$type, perl = TRUE )
				if (any(hit)){ this.psp$col[hit] <- col2[si] }
			}

			xj <- this.psp$pos %in% xi
			if (any(xj)){
				these.names <- c('pos', 'MOD_RSD', 'col')
				json_data$PhosphoSitePlus <- this.psp[xj, these.names]
			}
		}
	}
	## -----------------------------------------------------------------
	## ips
	if ("ips" %in% update_cols){
		this.ips <- dat$ips %>% filter(uniprot_id == curr_dat$uniprot_id)
		this.ips <- this.ips[ rev(order(this.ips$interpro_start)), ]
		m <- dim(this.ips)[2]
		mid <- apply( cbind( this.ips$interpro_end, this.ips$interpro_start ), 1, mean )

		these.names <- c('interpro', 'id', 'code', 'interpro_description', 'interpro_start', 'interpro_end', 'analysis_type')
		if (dim(this.ips)[[1]] > 0){
			json_data$ips <- this.ips[, these.names]
		}
		
		if (length(uniprot_info) == 1 && is.na(uniprot_info)){
			return(NULL)
		} else {
				
			## -----------------------------------------------------------------
			## Add data from UniProt
			if (('sites' %in% names(uniprot_info)) && !is.null(uniprot_info$sites) && (dim(uniprot_info$sites)[[1]] > 0)){
				json_data$uniprot_sites <- uniprot_info$sites
			}
			
			if (('variants' %in% names(uniprot_info)) && !is.null(uniprot_info$variants) && (dim(uniprot_info$variants)[[1]] > 0)){
				json_data$uniprot_variants <- uniprot_info$variants
			}

			## And SLIMs from UniProt
			if (('SLIM' %in% names(uniprot_info)) && !is.null(uniprot_info$SLIM) && (dim(uniprot_info$SLIM)[[1]] > 0)){
				
				up_slim <- uniprot_info$SLIM
				up_slim$interpro <- curr_dat$uniprot_id[[1]]
				up_slim$interpro_description <- uniprot_info$SLIM$description
				up_slim$interpro_start <- up_slim$start
				up_slim$interpro_end <- up_slim$stop
				up_slim$analysis_type <- "UniProt"
				
				if (dim(up_slim)[[1]] > 0){
					if (dim(this.ips)[1] > 0){
						json_data$ips <- rbind(json_data$ips, up_slim[, these.names])
					} else {
						json_data$ips <- up_slim[, these.names]
					}
				}
			}
		}
	}

	if ("elm" %in% update_cols){
		## -----------------------------------------------------------------
		## ELM

		curr_up <- curr_dat$uniprot_id
		f <- str_interp('data_files/elm/${curr_up}.csv')
		if (file.exists(f)){
			raw.elm <- read.table(f, sep = "\t", as.is = TRUE, header = TRUE)
			if ( dim(raw.elm)[1] > 0 ){
			
				raw.elm$description <- raw.elm$Regex <- raw.elm$Probability <- ''
				for (ri in 1:dim(raw.elm)[1]){
					ei <- ( dat$elm_ref$ELMIdentifier == raw.elm$elm_identifier[ri])

					if (any(is.na(ei))){
						ei[is.na(ei)] <- FALSE 
					}
					if( any(ei) ){
						raw.elm$description[ri] <-  dat$elm_ref$Description[ ei ]
						raw.elm$Regex[      ri] <-  dat$elm_ref$Regex[       ei ]
						raw.elm$Probability[ri] <-  dat$elm_ref$Probability[ ei ]
						raw.elm$Probability_color[ri] <-  dat$elm_ref$Probability_color[ei]
					}
				}
				json_data$ELM <- raw.elm
			}
		}
	}

	## -----------------------------------------------------------------
	## Homology to PDBs

	if ("pdb" %in% update_cols){
    	files <- paste0(path, 'data_files/hmmer/out')
   		curr_up <- curr_dat$uniprot_id[[1]]
   		fn <- str_interp("${files}/${curr_up}.pdb_coverage.dat")

   		if (file.exists(fn)){
			pdb <- read_tsv(fn)
    
			names(pdb)[names(pdb) == "transcript"] <- "uniprot_id"
		
			this.pdb <- pdb[pdb$uniprot_id == curr_dat$uniprot_id, ]

			if (dim(this.pdb)[[1]] > 0){
			
				tmp <- get_top_models(this.pdb)
				json_data$PDBCount <- tmp$PDBCount
				json_data$PDB <- tmp$PDB

			} else {
				json_data$PDB <- array(numeric(0))
			}
   		}
	}

	##-------------- ISOFORM MSA -----------------
	#Get all information for all transcripts associated with the current gene
	#Only use uniprot_id, since this will only include one of each unique sequence
	#Since multiple ENSP/ENST may map to the same sequence, and the sequence is all that's important for the MSA

	if ("isoform_msa" %in% update_cols){
		curr_isoform_curr_dat <- unique(dat$protein_transcripts$uniprot_id[dat$protein_transcripts$gene_symbol == curr_symbol])
		m <- match(curr_isoform_curr_dat, protein_transcripts$uniprot_id)
		sequences <- protein_transcripts$seq[m]
		names(sequences) <- protein_transcripts$uniprot_id[m]

		if (length(sequences) > 1){
			isoform_msa_json <- make_isoform_msa_json(sequences, curr_transcript)
		} else {
			isoform_msa_json <- "No isoforms found"
		}
		json_data$ISOFORM_MSA = isoform_msa_json
	}

	##-------------- PARALOG MSA -----------------
	if ("paralog_msa" %in% update_cols){
		curr_paralogs <- dat$paralogs[dat$paralogs$paralog_of_enst == curr_transcript, ]
		sequences <- curr_paralogs$seq
		names(sequences) <- curr_paralogs$uniprot_id

		if (length(sequences) > 1){
			paralog_msa_json <- make_isoform_msa_json(sequences)
		} else {
			paralog_msa_json <- "No paralogs found"
		}
		json_data$PARALOG_MSA = paralog_msa_json
	}

	return(json_data)
}
