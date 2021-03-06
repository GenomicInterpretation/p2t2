#!/usr/bin/python
import sys

activate_this = '/var/www/p2t2/backend/env/bin/activate_this.py'
with open(activate_this) as file_:
    exec(file_.read(), dict(__file__=activate_this))

sys.path.insert(0, '/var/www/p2t2')
from backend import create_app
application = create_app()