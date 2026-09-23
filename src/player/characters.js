export const characters = [
  { id: 'fox', name: '阿雪', title: '北极狐', description: '蓝色背包，装满好奇', portrait: 'characters/fox.png', labelHeight: 2.05, occlusionHeight: 2.1 },
  { id: 'nana', name: '小娜', title: '校园探险家', description: '系上绿围巾，去发现新故事', portrait: 'characters/nana.png', labelHeight: 2.7, occlusionHeight: 2.45 },
  { id: 'ming', name: '小鸣', title: '校园漫游者', description: '一身黑衣，轻装走遍校园', portrait: 'characters/ming.png', labelHeight: 2.6, occlusionHeight: 2.4 },
];
export const characterById = id => characters.find(character => character.id === id) || characters[0];
