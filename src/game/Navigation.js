// A* on a cached, collision-aware grid. Diagonals may never cut through corners.
export class Navigation {
 constructor(campus,blocked){this.blocked=blocked;this.minX=-campus.bounds.width/2+1;this.minZ=-campus.bounds.depth/2+1;this.cols=campus.bounds.width-1;this.rows=campus.bounds.depth-1;this.free=new Uint8Array(this.cols*this.rows);this.cost=new Float32Array(this.free.length);for(let z=0;z<this.rows;z++)for(let x=0;x<this.cols;x++){const wx=x+this.minX,wz=z+this.minZ,id=z*this.cols+x;this.free[id]=blocked(wx,wz)?0:1;this.cost[id]=campus.regions.some(r=>['path','plaza'].includes(r.type)&&Math.abs(wx-r.x)<r.w/2&&Math.abs(wz-r.z)<r.d/2)?1:(campus.crossings||[]).some(c=>Math.abs(wx-c.x)<2.5&&Math.abs(wz-c.z)<9)?1:campus.regions.some(r=>r.type==='road'&&Math.abs(wx-r.x)<r.w/2&&Math.abs(wz-r.z)<r.d/2)?2.5:1.65;}}
 id(x,z){return Math.max(0,Math.min(this.rows-1,Math.round(z-this.minZ)))*this.cols+Math.max(0,Math.min(this.cols-1,Math.round(x-this.minX)));}
 point(id){return{x:id%this.cols+this.minX,z:Math.floor(id/this.cols)+this.minZ};}
 clear(a,b){const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)*5));for(let i=0;i<=n;i++)if(this.blocked(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;return true;}
 nearest(x,z){const base=this.id(x,z);if(this.free[base])return base;let best=-1,dist=Infinity;for(let dz=-7;dz<=7;dz++)for(let dx=-7;dx<=7;dx++){const id=this.id(x+dx,z+dz),p=this.point(id),d=Math.hypot(p.x-x,p.z-z);if(this.free[id]&&d<dist){best=id;dist=d;}}return best;}
 find(from,to){
  const start=this.nearest(from.x,from.z),goal=this.nearest(to.x,to.z);if(start<0||goal<0)return[];
  const heap=[];const push=(id,f)=>{let i=heap.length;heap.push({id,f});while(i>0){const p=(i-1)>>1;if(heap[p].f<=f)break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}};const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let s=i,l=i*2+1,r=l+1;if(l<heap.length&&heap[l].f<heap[s].f)s=l;if(r<heap.length&&heap[r].f<heap[s].f)s=r;if(s===i)break;[heap[i],heap[s]]=[heap[s],heap[i]];i=s;}}return top.id;};
  const g=new Float32Array(this.free.length).fill(Infinity),prev=new Int32Array(this.free.length).fill(-1),closed=new Uint8Array(this.free.length),end=this.point(goal);g[start]=0;push(start,0);
  while(heap.length){const id=pop();if(closed[id])continue;if(id===goal){const path=[];let p=id;while(p!==start){path.unshift(this.point(p));p=prev[p];}if(!this.blocked(to.x,to.z)&&this.clear(path.at(-1)||from,to))path.push({x:to.x,z:to.z});return path;}
   closed[id]=1;const x=id%this.cols,z=Math.floor(id/this.cols);
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=this.cols||nz>=this.rows)continue;const n=nz*this.cols+nx;if(!this.free[n]||closed[n])continue;if(dx&&dz&&(!this.free[z*this.cols+nx]||!this.free[nz*this.cols+x]))continue;const dist=g[id]+Math.hypot(dx,dz)*this.cost[n];if(dist>=g[n])continue;g[n]=dist;prev[n]=id;push(n,dist+Math.hypot(nx+this.minX-end.x,nz+this.minZ-end.z));}
  }return[];
 }
}
