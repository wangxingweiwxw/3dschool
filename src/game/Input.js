import { VirtualJoystick } from './VirtualJoystick.js';
export class Input {
 constructor(){
  this.keys=new Set();this.onMap=()=>{};this.joystick=new VirtualJoystick(document.getElementById('virtual-joystick'));
  window.addEventListener('keydown',e=>{
   if(e.target.matches('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;
   if(e.code==='KeyM'&&!e.repeat){e.preventDefault();this.onMap();return;}
   if(document.querySelector('dialog[open]'))return;
   if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();this.keys.add(e.code);}
  });
  window.addEventListener('keyup',e=>this.keys.delete(e.code));
  window.addEventListener('blur',()=>this.reset());
  window.addEventListener('resize',()=>this.reset());
  document.addEventListener('visibilitychange',()=>this.reset());
  // A second finger may open a dialog while the first is holding the stick.
  new MutationObserver(()=>{if(document.querySelector('dialog[open]'))this.reset();}).observe(document.getElementById('app'),{subtree:true,attributes:true,attributeFilter:['open']});
 }
 reset(){this.keys.clear();this.joystick.reset();}
 get move(){let x=0,z=0;if(this.keys.has('KeyA')||this.keys.has('ArrowLeft'))x--;if(this.keys.has('KeyD')||this.keys.has('ArrowRight'))x++;if(this.keys.has('KeyW')||this.keys.has('ArrowUp'))z--;if(this.keys.has('KeyS')||this.keys.has('ArrowDown'))z++;const len=Math.hypot(x,z);return{x:len?x/len:this.joystick.x,z:len?z/len:this.joystick.z,running:this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')};}
}
