import datetime
import os
import git

from fastapi.responses import HTMLResponse, JSONResponse


TEMPLATE_DIR = os.path.join(__file__.split("generate_version")[0], "templates")
TEMPLATE_FILE = os.path.join(TEMPLATE_DIR, "version_template.html")

METADATA = {
    "Application": "Remote-GUI",
    "version": {},
    "author": "AnyLog Team",
    "description": "Remote-GUI for AnyLog / EdgeLake",
    "docs": "https://github.com/AnyLog-co/Remote-GUI",
    "license": "Copyright AnyLog Co."
}

def generate_version():
    global METADATA
    repo = git.Repo("")
    timestamp = datetime.datetime.fromtimestamp(
        repo.head.commit.committed_date,
        tz=datetime.timezone.utc
    ).strftime('%Y-%m-%d %H:%M:%S')

    short_hash = repo.git.rev_parse(repo.head.commit.hexsha, short=5)

    METADATA["version"] = {
        "commit": short_hash,
        "date": timestamp
    }

def create_html_file():
    if not os.path.isfile(TEMPLATE_FILE):
        raise FileNotFoundError(f"Fail {TEMPLATE_FILE} not found")

    with open(TEMPLATE_FILE, 'r') as f:
        html_content = f.read()
    html_content = html_content.replace('<span class="label" style="padding-left: 2em;">&nbsp;&nbsp;&nbsp;<b>Date</b>: XXX | <b>Commit</b>: XXX</span>',
                                        f'<span class="label" style="padding-left: 2em;">&nbsp;&nbsp;&nbsp;<b>Date</b>: {METADATA["version"]["date"]} | <b>Commit</b>: {METADATA["version"]["commit"]}</span>')
    return html_content

def write_html():
    generate_version()
    html_file = os.path.join(TEMPLATE_DIR, "version.html")
    with open(html_file, 'w') as f:
        f.write(create_html_file())

if __name__ == "__main__":
    write_html()
