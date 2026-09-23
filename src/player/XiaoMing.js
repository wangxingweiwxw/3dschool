import * as THREE from 'three';
import { box } from '../world/voxel.js';
import { CampusWalker } from './CampusWalker.js';

export class XiaoMing extends CampusWalker {
  build() {
    const c = { skin: 0xdfb58f, shade: 0xbd8c6c, hair: 0x20221f, hairLight: 0x343732,
      jacket: 0x262c2e, seam: 0x3b4243, cuff: 0x1a2023, shirt: 0x687373,
      pants: 0x303638, shoe: 0x202629, sole: 0xc2c7bd, metal: 0x99aaa4 };
    this.body = new THREE.Group();
    this.group.add(this.body);

    // A broad, boxy black jacket with readable charcoal panels and a pale zip.
    box(this.body, .64, .62, .4, c.jacket, 0, 1.2, 0);
    box(this.body, .22, .18, .06, c.shirt, 0, 1.45, .21);
    for (const side of [-1, 1]) {
      box(this.body, .24, .51, .065, c.seam, side * .175, 1.18, .22);
      box(this.body, .2, .47, .025, c.jacket, side * .18, 1.18, .263);
      const pocket = box(this.body, .13, .035, .025, c.cuff, side * .21, 1.04, .283);
      pocket.rotation.z = side * .32;
      const collar = box(this.body, .18, .16, .12, c.cuff, side * .18, 1.49, .16);
      collar.rotation.z = side * .25;
    }
    box(this.body, .022, .49, .024, c.metal, 0, 1.16, .26);
    box(this.body, .035, .065, .025, c.metal, 0, 1.4, .278);
    box(this.body, .66, .09, .42, c.cuff, 0, .9, 0);
    box(this.body, .12, .04, .02, c.metal, .19, 1.34, .28);
    box(this.body, .22, .17, .23, c.skin, 0, 1.58, 0);

    this.head = new THREE.Group();
    this.head.position.set(0, 1.87, 0);
    this.body.add(this.head);
    box(this.head, .59, .51, .46, c.skin, 0, 0, .01);
    // Cropped sides and a low, stepped fringe distinguish him from Nana's bob.
    box(this.head, .63, .26, .15, c.hair, 0, .17, -.22);
    box(this.head, .65, .16, .54, c.hair, 0, .28, -.02);
    box(this.head, .5, .07, .43, c.hairLight, -.035, .395, -.045);
    box(this.head, .3, .06, .37, c.hair, .08, .425, -.035);
    box(this.head, .08, .25, .36, c.hair, -.3, .13, -.025);
    box(this.head, .08, .22, .36, c.hair, .3, .145, -.025);
    box(this.head, .3, .12, .08, c.hair, -.15, .21, .257);
    box(this.head, .14, .065, .08, c.hair, .09, .235, .257);
    for (const side of [-1, 1]) {
      box(this.head, .075, .135, .11, c.skin, side * .32, -.06, .015);
      box(this.head, .17, .11, .025, 0xf1ebd7, side * .135, -.01, .255);
      box(this.head, .065, .09, .028, c.hair, side * .135 + .012, -.01, .274);
      box(this.head, .16, .035, .028, c.hair, side * .14, .09, .262);
    }
    box(this.head, .075, .075, .07, c.skin, 0, -.095, .27);
    box(this.head, .095, .025, .022, c.shade, 0, -.195, .253);

    this.arms = [-1, 1].map(side => {
      const arm = new THREE.Group();
      arm.position.set(side * .41, 1.44, 0);
      this.body.add(arm);
      box(arm, .23, .29, .32, c.jacket, 0, -.1, 0);
      box(arm, .195, .25, .26, c.jacket, 0, -.35, .025);
      box(arm, .2, .08, .27, c.cuff, 0, -.49, .025);
      box(arm, .17, .15, .2, c.skin, 0, -.605, .03);
      arm.rotation.z = side * .065;
      return arm;
    });
    this.legs = [-1, 1].map(side => {
      const leg = new THREE.Group();
      leg.position.set(side * .17, .86, 0);
      this.body.add(leg);
      box(leg, .27, .34, .35, c.pants, 0, -.12, 0);
      box(leg, .23, .32, .29, c.pants, 0, -.43, 0);
      box(leg, .235, .07, .3, c.cuff, 0, -.615, 0);
      box(leg, .25, .17, .4, c.shoe, 0, -.72, .055);
      box(leg, .27, .055, .42, c.sole, 0, -.805, .055);
      box(leg, .16, .025, .1, c.sole, 0, -.638, .14);
      return leg;
    });
    // A compact black daypack gives the following camera a little silhouette.
    this.bag = new THREE.Group();
    this.bag.position.set(0, 1.22, -.33);
    this.body.add(this.bag);
    box(this.bag, .43, .48, .23, c.cuff, 0, 0, 0);
    box(this.bag, .31, .22, .07, c.seam, 0, -.055, -.15);
    box(this.bag, .26, .025, .025, c.metal, 0, .07, -.192);
    for (const side of [-1, 1]) box(this.body, .06, .4, .055, c.cuff, side * .22, 1.28, .28);
  }
}
