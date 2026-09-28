import * as THREE from 'three';
import { box } from '../world/voxel.js';
import { CampusWalker } from './CampusWalker.js';

// Short hair, green scarf and field clothes, inspired by the supplied reference.
export class XiaoNa extends CampusWalker {
  build() {
    const c = { skin: 0xe6bc91, cheek: 0xd89e80, hair: 0x302e29, highlight: 0x474039,
      shirt: 0xe5d6ae, vest: 0xb4a071, shorts: 0x998453, olive: 0x62764a,
      scarf: 0x82945b, bag: 0x67482e, leather: 0x493322, buckle: 0xc3a46a, sock: 0xbac0a0, eye: 0x322e25 };
    this.body = new THREE.Group();
    this.group.add(this.body);
    box(this.body, .56, .6, .35, c.shirt, 0, 1.18, 0);
    box(this.body, .21, .5, .08, c.vest, -.17, 1.14, .205);
    box(this.body, .21, .5, .08, c.vest, .17, 1.14, .205);
    box(this.body, .58, .14, .39, c.shorts, 0, .86, 0);
    box(this.body, .59, .075, .4, c.leather, 0, .94, 0);
    box(this.body, .1, .08, .025, c.buckle, .08, .94, .22);
    box(this.body, .2, .15, .21, c.skin, 0, 1.55, 0);

    this.head = new THREE.Group();
    this.head.position.set(0, 1.85, 0);
    this.body.add(this.head);
    box(this.head, .57, .52, .45, c.skin, 0, 0, .02);
    box(this.head, .65, .57, .2, c.hair, 0, .015, -.22);
    box(this.head, .66, .16, .56, c.hair, 0, .29, -.025);
    box(this.head, .16, .52, .43, c.hair, -.29, .03, -.03);
    box(this.head, .12, .36, .38, c.hair, .29, .04, -.065);
    box(this.head, .32, .18, .12, c.hair, -.18, .19, .24);
    box(this.head, .15, .16, .09, c.hair, -.265, .035, .26);
    box(this.head, .26, .08, .32, c.highlight, -.14, .395, -.08);
    box(this.head, .12, .13, .13, c.hair, -.015, .47, -.14);
    const tuft = box(this.head, .085, .13, .09, c.hair, .05, .56, -.16);
    tuft.rotation.z = -.3;
    box(this.head, .11, .15, .12, c.skin, -.315, -.12, .1);
    box(this.head, .09, .14, .1, c.skin, .31, -.12, .1);
    for (const x of [-.125, .145]) {
      box(this.head, .205, .135, .026, 0xf5efda, x, -.015, .257);
      box(this.head, .062, .095, .03, c.eye, x + .024, -.012, .28);
      box(this.head, .075, .038, .026, c.cheek, x, -.12, .258);
    }
    box(this.head, .065, .068, .065, c.skin, .025, -.09, .278);
    box(this.head, .08, .025, .018, c.cheek, .025, -.195, .254);

    box(this.body, .42, .16, .44, c.olive, 0, 1.48, .025);
    box(this.body, .33, .11, .085, c.scarf, 0, 1.41, .265);
    this.scarf = new THREE.Group();
    this.scarf.position.set(-.07, 1.38, .25);
    this.body.add(this.scarf);
    box(this.scarf, .17, .28, .055, c.olive, 0, -.1, .02);
    box(this.scarf, .17, .06, .06, c.scarf, 0, -.235, .02);

    this.arms = [-1, 1].map(side => {
      const arm = new THREE.Group();
      arm.position.set(side * .37, 1.4, 0);
      this.body.add(arm);
      box(arm, .2, .19, .3, c.shirt, 0, -.08, 0);
      box(arm, .145, .32, .18, c.skin, 0, -.31, .025);
      box(arm, .16, .12, .2, c.olive, 0, -.49, .025);
      box(arm, .16, .13, .19, c.skin, 0, -.61, .025);
      arm.rotation.z = side * .06;
      return arm;
    });
    this.legs = [-1, 1].map(side => {
      const leg = new THREE.Group();
      leg.position.set(side * .16, .84, 0);
      this.body.add(leg);
      box(leg, .27, .27, .37, c.shorts, 0, -.08, 0);
      box(leg, .16, .19, .19, c.skin, 0, -.29, 0);
      box(leg, .18, .23, .21, c.sock, 0, -.48, 0);
      box(leg, .21, .24, .25, c.leather, 0, -.685, .02);
      box(leg, .23, .12, .38, c.bag, 0, -.75, .075);
      return leg;
    });
    // Cross-body satchel: readable both from the front and the following camera.
    for (const z of [-.235, .29]) {
      const strap = box(this.body, .095, .78, .06, c.leather, -.01, 1.18, z);
      strap.rotation.z = -.56;
    }
    this.bag = new THREE.Group();
    this.bag.position.set(-.4, .88, -.09);
    this.body.add(this.bag);
    box(this.bag, .34, .4, .33, c.bag, 0, 0, 0);
    box(this.bag, .37, .16, .36, c.leather, 0, .13, 0);
    box(this.bag, .075, .16, .04, c.buckle, 0, .04, .195);
    box(this.bag, .07, .11, .04, c.buckle, 0, .06, -.195);
  }

}
