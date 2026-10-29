import sys
import os

# Ensure current directory is in sys.path
path = os.path.dirname(os.path.abspath(__file__))
if path not in sys.path:
    sys.path.insert(0, path)

from a2wsgi import ASGIMiddleware
from main import app as fastapi_app

# WSGI callable for PythonAnywhere / Gunicorn WSGI
application = ASGIMiddleware(fastapi_app)
