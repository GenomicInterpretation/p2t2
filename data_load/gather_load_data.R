require(dplyr)
require(readr)
require(scales)
require(RColorBrewer)
require(crul)
require(XML)
require(data.table)

path <- "/home/edevoe/p2t2/data_load/"
source(paste0(path, 'utils.R'))

gather_load_data <- function(update_cols){
    if (update_cols == "ALL"){
        update_cols = DEFAULT_COLS
    }
    dat <- list()
    
    protein_transcripts <-readr::read_tsv("data_files/protein_transcripts.tsv")
    ensembl_symbol_map <-readr::read_tsv("data_files/ensembl_symbol_map.tsv")
    m <- match(protein_transcripts$enst, ensembl_symbol_map$enst)
    protein_transcripts$ensembl_gene_symbol <- ensembl_symbol_map$gene_symbol[m]
    dat$protein_transcripts <- protein_transcripts
    
    #IPS
    if ("ips" %in% update_cols){
        ips <- read_tsv(paste0(path, "data_files/ips.tsv"), col_names = FALSE)
        names(ips) <- c("uniprot_id", "hash", "hashsize", "analysis_type", "id", "code", 
                        "interpro_start", "interpro_end", "e_value", "match", "date", 
                        "interpro", "interpro_description")
        dat$ips <- ips
    }
    
    ## PSP
    if ("psp" %in% update_cols){
        # concat Methylation, O-Gal, O-Glc, Phosphorylation into PSP
        phos_files <- c("Methylation_site_dataset.gz", "O-GalNAc_site_dataset.gz", "O-GlcNAc_site_dataset.gz", "Phosphorylation_site_dataset.gz")
        psp <- phos_files %>% lapply(function(f){
            currfn <- paste0(path, "data_files/phosphositeplus/", f)
            if (file.exists(currfn)){
                return(read_tsv(currfn, skip = 3))
            }
           return(NULL)
        }) %>% do.call("rbind", .) %>% as.data.frame(stringsAsFactors = FALSE)
        #Linking field is ACC_ID <-> uniprot_id
        dat$psp <- psp
    }
    
    ## PTMs
    if ("ptm" %in% update_cols){
        fn <- paste0(path, "data_files/PTMcode2/PTMcode2_associations_within_proteins.txt.gz")
        ptm <- read_tsv(fn, skip = 3)
        names(ptm) <- remove_header_comment(names(ptm))
        ptm <- ptm[ptm$Species == "Homo sapiens", ]
    
        #Map ptms to ENSP
        nog_map <- read_tsv(paste0(path, "data_files/PTMcode2/NOG.members.txt.gz"))
        homnogs <- nog_map[grepl("(9606.ENSP)", nog_map[["protein name"]]), c("protein name", "start position", "end position")]
        names(homnogs) <- c("ensp", "start", "end")
        homnogs$ensp <- substr(homnogs$ensp, 6, nchar(homnogs$ensp))
    
        #Now have the ensp used by PTMCode2. 
        #Gene symbols are given, but the author has confirmed that the eggnog transcripts are the ones used
        
        m <- match(homnogs$ensp, protein_transcripts$ensp)
        homnogs$ensembl_gene_symbol <- protein_transcripts$ensembl_gene_symbol[m]
    
        m <- match(ptm$Protein, homnogs$ensembl_gene_symbol)
        ptm$ensp <- homnogs$ensp[m]
        dat$ptm <- ptm
    }

    ## BioR Catalogs (gnomAD, HGMD, ClinVar)
    if ("gnomad" %in% update_cols){
        fn <- paste0(path, "data_files/gnomad_drilled.tsv.gz")
        gnomad <- read_tsv(fn)
        dat$gnomad <- gnomad
    }
    
    if ("hgmd" %in% update_cols){
        fn <- paste0(path, "data_files/hgmd_drilled.vcf.gz")
        hgmd <- read_bior_catalog_file(fn)
        hgmd$PHEN <- gsub('"', '', hgmd$PHEN)
        dat$hgmd <- hgmd
    }
    
    if ("clinvar" %in% update_cols){
        fn <- paste0(path, "data_files/clinvar_drilled.vcf.gz")
        clinvar <- read_bior_catalog_file(fn)
        
        ## Split ClinVar out into 3 categories for easier visualization of each
        j <- grepl('pathogenic', clinvar$CLINICAL_SIGNIFICANCE, ignore.case = TRUE)
        i <- (!j) & grepl('benign', clinvar$CLINICAL_SIGNIFICANCE, ignore.case = TRUE)
        
        clinvar_pathog <- clinvar[j, ]
        clinvar_benign <- clinvar[i, ]
        clinvar_other  <- clinvar[!(i|j), ]
        dat$clinvar <- list(clinvar_pathog = clinvar_pathog, clinvar_benign = clinvar_benign, clinvar_other = clinvar_other)
    }

    #ELM
    if ("elm" %in% update_cols){
        ## -------------------------------
        ## Read in ELM motif reference.
        ## Make a color scale for ELM motifs based on their probability of occurrence.
        ## The predictions for individual proteins are read in later on.
        elm_ref <- read.table(paste0(path, 'data_files/elm/elm_classes.tsv'), sep = "\t", as.is = TRUE, header = TRUE)
        
        elm_ref$log2Prob <- (-log2(elm_ref$Probability))
        elm_ref$log2ProbUnif <- rescale(rank( elm_ref$log2Prob))
        
        cx <- rev(brewer.pal(11,'RdYlBu')[-6])
        elm_ref$Probability_color <- cx[cut(elm_ref$log2ProbUnif, 10, include.lowest = TRUE) %>% as.numeric(.)]
        dat$elm_ref <- elm_ref
    }

    ## -------------------------------
    ## CCDS Exon positions
    if ("ccds" %in% update_cols){
        f <- paste0(path, 'data_files/CCDS/CCDS_exons.current.txt.gz')
        ccds <- read_tsv(f, col_names = TRUE)
        names(ccds) <- remove_header_comment(names(ccds))
        
        f <- paste0(path, 'data_files/CCDS/CCDS2UniProtKB.current.txt.gz')
        ccds_map <- read_tsv(f, col_names = TRUE)
        names(ccds_map) <- remove_header_comment(names(ccds_map))
        dat$ccds <- left_join(ccds, ccds_map, by = c("ccds_id" = "ccds"))
        #Linking field is UniProtKB.x <-> uniprot_id
    }
    
    #Get paralogs
    if ("paralog_msa" %in% update_cols){
        dat$paralogs <- read_tsv(paste0(path, "data_files/paralogs.tsv"))
    }

    return(dat)
}
