$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\.."

if (Test-Path ".\venv\Scripts\Activate.ps1") {
    . .\venv\Scripts\Activate.ps1
}

python -m backend.mlops.pipeline --min-f1 0.60
