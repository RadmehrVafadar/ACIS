from billing.views import ledger, statement_list
from django.urls import path

urlpatterns = [path("", ledger), path("api/invoices", statement_list)]
