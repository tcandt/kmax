import os
import sys
import json
import subprocess
from pathlib import Path

def main():
    workspace = Path("d:/Skill-github").resolve()
    gemini_config = Path(os.path.expanduser("~/.gemini/config"))
    plugin_dir = gemini_config / "plugins" / "authorized-artifact-auditor"
    plugin_skills_dir = plugin_dir / "skills"
    global_skills_dir = gemini_config / "skills"

    plugin_skills_dir.mkdir(parents=True, exist_ok=True)
    global_skills_dir.mkdir(parents=True, exist_ok=True)

    plugin_json = {
        "name": "authorized-artifact-auditor",
        "version": "1.0.0",
        "description": "Authorized Artifact Auditor & Security/Reverse Engineering Skills Suite",
        "author": {
            "name": "ptn1411"
        },
        "repository": "https://github.com/ptn1411/skill",
        "license": "Authorized Use Only"
    }

    with open(plugin_dir / "plugin.json", "w", encoding="utf-8") as f:
        json.dump(plugin_json, f, indent=2)

    # Find all skill folders
    skills = []
    for item in sorted(workspace.iterdir()):
        if item.name.startswith("."):
            continue
        if item.is_dir() and (item / "SKILL.md").exists():
            skills.append((item.name, item))
        elif item.is_dir():
            for sub in sorted(item.iterdir()):
                if sub.is_dir() and (sub / "SKILL.md").exists():
                    skills.append((sub.name, sub))

    # Also include root skill
    skills.append(("authorized-artifact-auditor", workspace))

    print(f"Found {len(skills)} skills to register:")
    for name, src in skills:
        print(f"  - {name} ({src})")

    for name, src in skills:
        for dest_base in [plugin_skills_dir, global_skills_dir]:
            dest = dest_base / name
            if dest.exists():
                try:
                    os.rmdir(str(dest))
                except OSError:
                    subprocess.run(f'cmd /c rmdir /q "{dest}"', shell=True)
            
            cmd = f'cmd /c mklink /J "{dest}" "{src}"'
            res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            if res.returncode != 0:
                print(f"Failed to link {name} to {dest}: {res.stderr.strip()}")
            else:
                print(f"Successfully linked {name} -> {dest}")

if __name__ == "__main__":
    main()
