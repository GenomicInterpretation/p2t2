from .api import *

def test_uniprot_id():
    valid_ids = ["P84085","P20645","P11474","P84085-0","P20645-1",
                "P11474-2","P84085.0","P20645.1","P11474.2", "A0A087WPF7", 
                "Q03112-7", "P35749FAKEFAKEFAKE"]
    for id in valid_ids:
        assert(id_query(id) == "uniprot")