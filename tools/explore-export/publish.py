"""Publish a new, private export folder. Never update an existing research sheet."""
import argparse
import configparser
from datetime import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request
from urllib.error import HTTPError
from zoneinfo import ZoneInfo
from workbook import create


class Drive:
    def __init__(self, config):
        self.config = Path(config)
        settings = configparser.ConfigParser(interpolation=None)
        settings.read(self.config)
        section = settings['export']
        if section.get('scope') != 'drive.file' or not section.get('root_folder_id'):
            raise ValueError('Export requires a restricted Drive connection and a destination folder.')
        self.root_id = section['root_folder_id']

    def rclone(self, *args):
        result = subprocess.run(['rclone', '--config', str(self.config), '--log-level', 'ERROR', *args],
                                capture_output=True, text=True, timeout=240)
        if result.returncode:
            # OAuth messages can contain account/connection details. Keep public
            # Actions logs free of config, credentials, private links and paths.
            raise RuntimeError('Drive operation failed; check the private export connection. Stage: '+args[0])
        return result.stdout

    def metadata(self, file_id):
        settings = configparser.ConfigParser(interpolation=None)
        settings.read(self.config)
        token = json.loads(settings['export']['token'])['access_token']
        fields = 'id,name,mimeType,webViewLink,parents,permissions(type,role)'
        request = urllib.request.Request('https://www.googleapis.com/drive/v3/files/'+file_id+'?fields='+fields,
                                         headers={'Authorization': 'Bearer '+token})
        for attempt in range(6):
            try:
                with urllib.request.urlopen(request, timeout=30) as response: return json.load(response)
            except HTTPError as error:
                details = json.loads(error.read()).get('error', {})
                reasons = {item.get('reason') for item in details.get('errors', [])}
                retryable = error.code in (429, 500, 502, 503, 504) or bool(reasons & {'rateLimitExceeded', 'userRateLimitExceeded'})
                if not retryable or attempt == 5:
                    raise RuntimeError(f'Drive verification returned HTTP {error.code}'+(' (request quota; retry later).' if retryable else '.')) from None
                time.sleep(min(30, 2 ** (attempt+1)))

    def private(self, file_id):
        info = self.metadata(file_id)
        if not info.get('permissions') or any(p['role'] != 'owner' for p in info['permissions']):
            raise RuntimeError('Export destination is shared; choose a private folder before exporting.')
        return info

    def children(self, path):
        return json.loads(self.rclone('lsjson', path, '--max-depth', '1'))


def publish(folder, config):
    folder = Path(folder)
    data = json.loads((folder/'snapshot.json').read_text())
    for filename in ['Map.html', 'Map.png', 'Listings.geojson']:
        if not (folder/filename).is_file(): raise ValueError('Missing export output: '+filename)
    if not re.fullmatch(r'[A-Za-z0-9-]+', data['runId']): raise ValueError('Invalid export run reference.')
    drive = Drive(config)
    drive.rclone('lsjson', 'export:', '--dirs-only')  # Refresh an expired access token through rclone.
    drive.private(drive.root_id)
    instant = datetime.fromisoformat(data['exported'].replace('Z', '+00:00')).astimezone(ZoneInfo(data['zone']))
    parent = 'export:'+instant.strftime('%Y-%m')
    name = f"{data['day']} {data['when'].title()} {instant:%H%M%S} {data['runId']}"
    destination = parent+'/'+name
    drive.rclone('mkdir', parent)
    if any(item['Name'] == name for item in drive.children(parent)):
        raise RuntimeError('This export folder already exists. Start a new run; existing research is never replaced.')
    drive.rclone('mkdir', destination)
    record = next(item for item in drive.children(parent) if item['Name'] == name)
    drive.private(record['ID'])
    for filename in ['Map.html', 'Map.png', 'Listings.geojson']:
        drive.rclone('copyto', str(folder/filename), destination+'/'+filename, '--immutable')
    uploaded = drive.children(destination)
    links = {item['Name']: drive.private(item['ID']).get('webViewLink', '') for item in uploaded}
    workbook_name = f"Austin.chat {data['when'].title()} {data['day']} {instant:%H%M%S}.xlsx"
    create(data, folder/workbook_name, links)
    # Google Drive converts the styled workbook into a native, editable Sheet.
    drive.rclone('copy', str(folder/workbook_name), destination, '--drive-import-formats', 'xlsx',
                 '--drive-export-formats', 'xlsx', '--immutable')
    uploaded = drive.children(destination)
    # rclone may report the export MIME/name for a native Google document.
    sheets = [item for item in uploaded if item['Name'] in (Path(workbook_name).stem, workbook_name)]
    if len(sheets) != 1: raise RuntimeError('Expected one native Google spreadsheet after conversion.')
    sheet = drive.private(sheets[0]['ID'])
    if sheet['mimeType'] != 'application/vnd.google-apps.spreadsheet' or not sheet.get('webViewLink'):
        raise RuntimeError('Native spreadsheet verification failed.')
    manifest = dict(spreadsheet=sheet, folder=drive.private(record['ID']), files=links,
                    counts=dict(listings=len(data['records']), places=len(data['venues'])), exported=data['exported'])
    (folder/'drive-result.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f"Saved private {data['when']} export: {len(data['records'])} listings, {len(data['venues'])} places, native Google Sheet and maps.")
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
            summary.write(f"Created a private **{data['when'].title()}** export with **{len(data['records'])} listings** and **{len(data['venues'])} map places**.\n\nOpen your Austin.chat Explore Exports folder in Google Drive. Each run has its own folder and spreadsheet; no existing research was changed.\n")
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('folder')
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    try: publish(args.folder, args.config)
    except Exception as error:
        print(str(error))
        raise SystemExit(1)
