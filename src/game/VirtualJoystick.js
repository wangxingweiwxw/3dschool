export class VirtualJoystick {
 constructor(element){
  this.element=element;this.pointer=null;this.x=0;this.z=0;
  if(!element)return;
  this.knob=element.querySelector('.joystick-knob');
  element.addEventListener('pointerdown',event=>{
   if(this.pointer!==null||event.button!==0||document.querySelector('dialog[open]'))return;
   event.preventDefault();event.stopPropagation();
   const rect=element.getBoundingClientRect();
   this.center={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
   this.radius=(rect.width-this.knob.offsetWidth)/2-3;
   this.pointer=event.pointerId;element.setPointerCapture(event.pointerId);element.classList.add('active');this.update(event);
  });
  element.addEventListener('pointermove',event=>{
   if(event.pointerId!==this.pointer)return;
   event.preventDefault();event.stopPropagation();this.update(event);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,event=>{
   if(event.pointerId!==this.pointer)return;
   event.preventDefault();event.stopPropagation();this.reset();
  });
  element.addEventListener('contextmenu',event=>event.preventDefault());
 }
 update(event){
  const dx=event.clientX-this.center.x,dz=event.clientY-this.center.y,distance=Math.hypot(dx,dz);
  const length=Math.min(distance,this.radius),ratio=distance?length/distance:0;
  this.element.style.setProperty('--stick-x',`${dx*ratio}px`);this.element.style.setProperty('--stick-y',`${dz*ratio}px`);
  // Small center dead zone avoids drifting while resting a thumb on the stick.
  const amount=Math.max(0,(length/this.radius-.12)/.88);
  this.x=distance?dx/distance*amount:0;this.z=distance?dz/distance*amount:0;
 }
 reset(){
  const pointer=this.pointer;this.pointer=null;this.x=0;this.z=0;
  if(!this.element)return;
  this.element.classList.remove('active');this.element.style.setProperty('--stick-x','0px');this.element.style.setProperty('--stick-y','0px');
  if(pointer!==null&&this.element.hasPointerCapture(pointer))this.element.releasePointerCapture(pointer);
 }
}
