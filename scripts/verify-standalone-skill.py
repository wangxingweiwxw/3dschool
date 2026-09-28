"""Verify the install ZIP from an unrelated directory with no third-party Python."""
import hashlib,json,os,shutil,struct,subprocess,sys,tempfile,zipfile
from pathlib import Path

PROJECT=Path(__file__).resolve().parents[1]
ARCHIVE=PROJECT/'artifacts/school-map-to-campus-standalone.zip'
REPORT=PROJECT/'artifacts/standalone-skill-verification.json'

def main():
 with tempfile.TemporaryDirectory(prefix='campus-skill-isolated-') as folder:
  root=Path(folder).resolve();install=root/'different install location'/'校园技能';install.mkdir(parents=True)
  with zipfile.ZipFile(ARCHIVE) as z:
   for name in z.namelist():
    if not (install/name).resolve().is_relative_to(install):raise ValueError('Archive escapes installation directory')
   z.extractall(install)
  skill=install/'school-map-to-campus';work=root/'empty-workspace';work.mkdir()
  # Audit guard catches accidental reads from the original game or installed skill.
  harness=root/'isolated_runner.py'
  harness.write_text('''import os,runpy,sys
from pathlib import Path
target=Path(sys.argv[1]).resolve();sys.path.insert(0,str(target.parent));sys.argv=sys.argv[1:]
blocked=('d:/3dschool','c:/users/win/.codex/skills/school-map-to-campus')
def guard(event,args):
 if event=='open' and isinstance(args[0],(str,bytes,os.PathLike)):
  path=os.fsdecode(args[0]).replace('\\\\','/').lower()
  if any(path.startswith(prefix) for prefix in blocked):raise RuntimeError('Forbidden original-project read: '+path)
sys.addaudithook(guard)
runpy.run_path(str(target),run_name='__main__')
''',encoding='utf8')
  env=os.environ.copy();env['PYTHONNOUSERSITE']='1';env.pop('PYTHONPATH',None);env['PATH']=str(Path(os.environ.get('SystemRoot','C:/Windows'))/'System32')
  def run(script,*args):
   return subprocess.run([sys.executable,'-S','-X','utf8',str(harness),str(skill/'scripts'/script),*map(str,args)],cwd=work,env=env,capture_output=True,text=True,encoding='utf8',timeout=180)
  doctor=run('doctor.py');assert doctor.returncode==0,doctor.stderr
  build=run('build_package.py','--input',skill/'assets/campus-template.json','--out',work/'generated');assert build.returncode==0,build.stderr
  result=json.loads(build.stdout);package=Path(result['package']);manifest=json.loads((package/'manifest.json').read_text(encoding='utf8'))
  for file,digest in manifest['files'].items():assert hashlib.sha256((package/file).read_bytes()).hexdigest()==digest
  glb=(package/'campus.glb').read_bytes();assert struct.unpack('<4sII',glb[:12])==(b'glTF',2,len(glb))
  validation=json.loads((package/'validation.json').read_text(encoding='utf8'))
  assert validation['glb']['roundTripLoaded'] and validation['spawnClear']
  assert all(r['reachable'] for r in validation['routes'])
  assert validation['generator']['standalone'] and not validation['generator']['projectRequired']
  assert (package/'preview.png').read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
  duplicate=run('build_package.py','--input',skill/'assets/campus-template.json','--out',work/'generated')
  assert duplicate.returncode!=0 and 'refusing to overwrite' in duplicate.stderr
  bad=json.loads((skill/'assets/campus-template.json').read_text(encoding='utf8'));building=next(r for r in bad['campus']['regions'] if r.get('recipe')=='teaching-block');bad['campus']['spawn'].update(x=building['x'],z=building['z'])
  badfile=work/'blocked.json';badfile.write_text(json.dumps(bad,ensure_ascii=False),encoding='utf8')
  rejected=run('build_package.py','--input',badfile,'--out',work/'bad-output');assert rejected.returncode!=0 and '出生点' in rejected.stderr,rejected.stderr
  assert not (work/'bad-output').exists()
  # Missing runtime dependency must be diagnosed rather than read from elsewhere.
  dependency=skill/'runtime/vendor/three/build/three.module.js';dependency.rename(dependency.with_suffix('.absent'))
  broken=run('doctor.py');assert broken.returncode!=0 and 'Missing runtime file' in broken.stderr
  dest=PROJECT/'artifacts/standalone-portability-sample'
  if dest.exists():raise FileExistsError(dest)
  shutil.copytree(package,dest)
  report={'archive':ARCHIVE.name,'sha256':hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),'relocatedInstall':True,'nonAsciiAndSpacesPath':True,'unrelatedWorkingDirectory':True,'originalProjectReadsBlocked':True,'originalInstalledSkillReadsBlocked':True,'pythonSitePackagesDisabled':True,'nodeNotOnPath':True,'doctor':json.loads(doctor.stdout),'glbBytes':len(glb),'routes':len(validation['routes']),'roundTrip':True,'manifestHashes':True,'duplicateRejected':True,'blockedSpawnRejected':True,'missingDependencyRejected':True,'browserPlatformsActuallyTested':['Windows Chrome'],'runtimeRequests':validation['generator']['runtimeFilesRequested'],'sample':str(dest)}
  REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
