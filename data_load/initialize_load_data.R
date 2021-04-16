require(tidyverse)
require(seqinr)
require(data.table)
require(biomaRt)
require(bio3d)

#RUN ME USING R CMD BATCH initialize_load_data.R
#output will be piped to initialize_load_data.Rout

system("module load bedtools2 bior")

#Start with all ids
#biomaRt queries to peptide sequences time out. Download Ensembl flat file to get them.
system("wget ftp://ftp.ensembl.org/pub/release-87/fasta/homo_sapiens/pep/Homo_sapiens.GRCh38.pep.all.fa.gz")

#Get uniprot fasta files (canonical and isoform sequences)
system("wget ftp://ftp.uniprot.org/pub/databases/uniprot/current_release/knowledgebase/complete/uniprot_sprot.fasta.gz")
system("wget ftp://ftp.uniprot.org/pub/databases/uniprot/current_release/knowledgebase/complete/uniprot_sprot_varsplic.fasta.gz")
system("cat uniprot_sprot.fasta.gz uniprot_sprot_varsplic.fasta.gz > up_full.fasta.gz")
system("rm uniprot_sprot_varsplic.fasta.gz uniprot_sprot.fasta.gz")

ens_human <- seqinr::read.fasta("Homo_sapiens.GRCh38.pep.all.fa.gz", seqtype = "AA") %>% lapply(function(x){
    ensp <- getName(x) %>% strsplit(".", fixed = TRUE) %>% sapply(`[`, 1)
    enst <- sub('.*transcript:(.*?)\\..*', '\\1', getAnnot(x)) %>% strsplit(".", fixed = TRUE) %>% sapply(`[`, 1)
    seq <- seqinr::getSequence(x)
    return(data.frame(ensp = ensp, enst = enst, seq = paste(seq, collapse="")))
}) %>% dplyr::bind_rows(.)

#Get ensembl gene symbol
ensembl_symbol_map <- seqinr::read.fasta("Homo_sapiens.GRCh38.pep.all.fa.gz", seqtype = "AA") %>% lapply(function(x){
    enst <- sub('.*transcript:(.*?)\\..*', '\\1', getAnnot(x)) %>% strsplit(".", fixed = TRUE) %>% sapply(`[`, 1)
    gene_symbol <- sub('.*gene_symbol:(.*?) .*', '\\1', getAnnot(x)) %>% strsplit(".", fixed = TRUE) %>% sapply(`[`, 1)
    return(data.frame(enst = enst, gene_symbol = gene_symbol))
}) %>% dplyr::bind_rows(.)
write.table(ensembl_symbol_map, file = "ensembl_symbol_map.tsv", row.names = FALSE, quote = FALSE, sep = '\t')

#Filter out non-human sequences
tmp_fasta <- seqinr::read.fasta("up_full.fasta.gz", seqtype = "AA", as.string = FALSE)
uniprot_human <- tmp_fasta %>% lapply(function(x){
    uniprot_id <- getName(x) %>% strsplit("|", fixed = TRUE) %>% sapply(`[`, 2) 
    header <- getAnnot(x)
    if (stringr::str_detect(header, "OS=Homo") == FALSE){
        return(NULL)
    }
    gene_symbol <- sub(".*\\| *(.*?) *_HUMAN.*", "\\1", header)
    seq <- seqinr::getSequence(x)

    #Uniprot canonical sequences are ID-1 or ID
    is_canonical_isoform <- TRUE
    if (str_detect(uniprot_id, "-") && !str_detect(uniprot_id, "-1")){
        is_canonical_isoform <- FALSE
    }
    return(data.frame(uniprot_id = uniprot_id, gene_symbol = gene_symbol, seq = paste(seq, collapse = ""), is_canonical_isoform = is_canonical_isoform))
}) %>% dplyr::bind_rows(.)

#Map from uniprot to ensembl via sequence. 
#Uniprot generally has non-fragment isoforms, so we will keep transcripts that mutually map between uniprot and ensembl
protein_transcripts <- inner_join(uniprot_human, ens_human, by = "seq")
write.table(protein_transcripts, file = "protein_transcripts.tsv", row.names = FALSE, quote=FALSE, sep='\t')

#Make list of ensts for CAVA config
transcript_ids <- protein_transcripts$enst 
fileConn<-file("transcript_ids.txt")
writeLines(transcript_ids, fileConn)
close(fileConn)

#Make ensembl db_file for CAVA
system("/rcc/stor1/depts/gspmc/BDAU/software/CAVA/ensembl_db -e 93 -o p2t2_ensembl_db")
human <- useMart("ensembl", dataset = "hsapiens_gene_ensembl", host="uswest.ensembl.org")
if (!dir.exists("ips")){
    system("mkdir ips")
}
setwd("ips")
setup_multicore_fasta(protein_transcripts)

files <- list.files(path = "fastas", pattern = "*.fasta", full.names = TRUE, recursive = FALSE)
for (curr_file in files){
    i <- strsplit(curr_file, '\\.')[[1]][[1]] %>% substring(., nchar(fasta_dir) + 1)

    job_name <- str_interp("p2t2_ips_${i}")
    fileConn <- file(str_interp("${job_name}.pbs"))
    queue <- "#PBS -q bigmem"
    mem <- '6GB'

    writeLines(
        c(str_interp("#PBS -N ${job_name}"),
            "#PBS -m bae",
            "#PBS -l nodes=1:ppn=1",
            str_interp("#PBS -l mem=${mem}"),
            "#PBS -l walltime=3:00:00:00",
            "#PBS -j oe",
            queue,
            "",
            "cd $PBS_O_WORKDIR",
            "module load interproscan",
            str_interp("interproscan.sh -i /home/edevoe/p2t2/ips/${curr_file} -o /home/edevoe/p2t2/ips/out/${job_name} -f tsv -dp")),
        fileConn)
    close(fileConn)
    system(str_interp("qsub ${job_name}.pbs"))
}
system("cat out/* ips.tsv")
setwd("..")

#Genes that are paralogs of each reference gene
paralogs <- getBM(attributes = c("ensembl_transcript_id",
									"external_gene_name",
									"hsapiens_paralog_canonical_transcript_protein",
                                	"hsapiens_paralog_associated_gene_name",
									"hsapiens_paralog_ensembl_peptide"),
                	filters = "ensembl_transcript_id",
                	values = unique(protein_transcripts$enst),
                	mart = human)

m <- match(paralogs$hsapiens_paralog_ensembl_peptide, ens_human$ensp)
paralogs$seq <- ens_human$seq[m]
paralogs$hsapiens_paralog_canonical_transcript_protein <- NULL
names(paralogs) <- c("paralog_of_enst", "paralog_of_gene_symbol", "gene_symbol", "ensp", "seq")

paralogs$uniprot_id <- protein_transcripts$uniprot_id[match(paralogs$ensp, protein_transcripts$ensp)]
paralogs <- paralogs[!is.na(paralogs$uniprot_id), ]
write.table(paralogs, file = "paralogs.tsv", quote = F, sep = "\t", row.names = F)

#Make bedfile for bioR catalog inersect
bed <- getBM(attributes = c("chromosome_name", "transcript_start", "transcript_end"),
        filter = "ensembl_transcript_id",
        values =  protein_transcripts$enst,
        mart = human)

names(bed) <- c("chrom", "chromStart", "chromEnd")

#Bedfiles are start 0-indexed, end 1-indexed
bed$chromStart <- bed$chromStart - 1

#The required golden attributes are: 
# '_landmark', '_minBP', '_refAllele', '_altAlleles'

write.table(bed, file = "transcripts.bed", quote = F, sep = "\t", row.names = F, col.names = F)

#V is for version sort - this sorts numbers first in natural order, then alphabet characters
#Sorting performed in order to speed up bedtools intersect command below

system('sort -V -k1,1 -k2,2n transcripts.bed > transcripts_sorted.bed')
system("rm transcripts.bed")

#Submit jobs for each catalog
for(curr_name in c("hgmd", "clinvar", "gnomad")){
    bed2anno("transcripts_sorted.bed", curr_name, submit = TRUE)
}

system("mkdir hmmer/hmmer_fastas")
system("mkdir hmmer/hmmer_out")
system("mkdir hmmer/hmmer3")
setwd("./hmmer")

#Get Hmmer DB file
system("wget ftp://ftp.wwpdb.org/pub/pdb/derived_data/pdb_seqres.txt.gz")
system("gunzip pdb_seqres.txt.gz")
system("mv pdb_seqres.txt pdb_seqres.fasta")

#HMMER3 requires 36L^2 memory where L is sequence length
#RCC requires estimated memory and wall time for job submission, and space is distributed
# equally between jobs. An efficient way to distribute space/time is to split up 
# Amino acids sequences ~equally in terms of number of amino acids between jobs
# TODO scale with longest sequence instead since L^2 = 4 * (L/2)^2

pdb_seqs <- unique(protein_transcripts[, c("uniprot_id", "seq")])
fasta_dir <- "fastas/"

#If needing to re-run, but don't want overlap
#write.table(unique(pdb$uniprot_id), file = "extant_hmmer_ids.tsv", row.names = FALSE, quote = FALSE, sep = '\t')
#extant_ids <- vroom::vroom("extant_hmmer_ids.tsv")[["x"]]
#pdb_seqs <- pdb_seqs[!pdb_seqs$uniprot_id %in% extant_ids, ]
setup_multicore_fasta(pdb_seqs)

files <- list.files(path = "fastas", pattern = "*.fasta", full.names = TRUE, recursive = FALSE)
for (curr_file in files){
    max_seqlen <- as.numeric(strsplit(curr_file, '\\.')[[1]][[2]])
    mem <- 5 * 38 * max_seqlen * max_seqlen
    i <- strsplit(curr_file, '\\.')[[1]][[1]] %>% substring(., nchar(fasta_dir) + 1)

    job_name <- str_interp("p2t2_hmmer_${i}.pbs")
    fileConn <- file(job_name)

    mem <- paste0(mem, 'b')
    writeLines(
        c(str_interp("#PBS -N p2t2_hmmer_${i}"),
            "#PBS -m bae",
            "#PBS -l nodes=1:ppn=1",
            str_interp("#PBS -l mem=${mem}"),
            "#PBS -l walltime=6:23:59:59",
            "#PBS -j oe",
            "cd $PBS_O_WORKDIR",
            "module load hmmer/3.2.1 perl",
            str_interp("perl Hmmer2PDB.pl ${curr_file} out/${i}.coverage_by_PDBs.dat")),
        fileConn)
    close(fileConn)
    system(str_interp("qsub ${job_name}"))
}

system("head -1 1.coverage_by_PDBs.dat > p2t2_coverage_by_PDBs.dat")
system("tail -n +2 -q *.coverage_by_PDBs.dat >> p2t2_coverage_by_PDBs.dat")
system("bgzip p2t2_coverage_by_PDBs.dat")

setwd("..")
system("rmdir tmp_out")
#Remove logging files
#system("rm ./*.fasta.*")

#------- PTMs --------
# Get PTM mapping file (PTMcode2 authors choose the "longest" isoform for each gene)
# Have to do this manually for now. Download NOG.members.txt.gz")
# Get PTM file with PTMcode2/ABOUT.sh
system("PTMcode2/ABOUT.sh")

#----- CCDS (exons) -----
#Download CCDS Exon data
system("CCDS/get_CCDS_data.sh")
system("bgzip CCDS/CCDS_exons.current.txt")
system("bgzip CCDS/CCDS2UniProtKB.current.txt")

#----- PSP -----
# Phosphorylation sites (PSP) must be manually downloaded from https://www.phosphosite.org/
# Download Methylation, O-Gal, O-Glc, Phosphorylation files

#----- ELM -----
#This may have to be run multiple times, since ELM locks download requests from a single IP
system("wget http://elm.eu.org/elms/elms_index.tsv")
system("mkdir elm")
setwd("elm")

#ELM only has canonical sequences
non_versioned_ids <- protein_transcripts$uniprot_id %>% sapply(function(x){
    return(str_split(x, "-")[[1]][[1]])
}) %>% unique()

fileConn <- file("p2t2_elm.pbs")
writeLines(
c('#PBS -N p2t2_elm',
    '#PBS -m bae',
    '#PBS -l nodes=1:ppn=1',
    '#PBS -l mem=5GB',
    '#PBS -l walltime=6:00:00:00',
    '#PBS -j oe',
    '',
    'cd $PBS_O_WORKDIR'),
fileConn)
close(fileConn)

elm_api <- 'wget --read-timeout=3600 http://elm.eu.org/start_search/'
out <- non_versioned_ids %>% lapply(function(curr_up_id){
    # space out requests - wget error 429 is a temprary block due to too many requests
    if (!file.exists( sprintf('%s.csv', curr_up_id) )){`
        fileConn <- "p2t2_elm.pbs"
        write(paste0(elm_api, curr_up_id, ".csv"), file = fileConn, append = TRUE)
        write(paste0("sleep ", signif(rnorm(1, mean = 9, sd = 2), 2) ), file = fileConn, append = TRUE)
    }
})
system("qsub p2t2_elm.pbs")

#NextProt
system("wget ftp://ftp.nextprot.org/pub/current_release/xml/nextprot_all.xml.gz")

#clean up
system("rm up_full.fasta.gz")