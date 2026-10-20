import { beforeEach, describe, expect, it } from 'vitest';
import { importFdxTags, readFdxTags } from './fdxTags';
import { useScreenplayStore } from '../store/screenplayStore';
import type { ScreenplayElement } from '../types/screenplay';

// A tiny Final Draft file in Tags Mode format, written for this test
const FDX = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="6">
  <Content>
    <Paragraph Type="Scene Heading"><Text TagNumber="1">INT. DINER</Text><Text> - NIGHT</Text></Paragraph>
    <Paragraph Type="Action"><Text TagNumber="2">MAYA</Text><Text> slides a </Text><Text TagNumber="3">silver key</Text><Text> across the counter.</Text></Paragraph>
    <Paragraph Type="Character"><Text TagNumber="2">MAYA</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>Keep it.</Text></Paragraph>
    <Paragraph Type="Scene Heading"><Text>EXT. PARKING LOT - NIGHT</Text></Paragraph>
    <Paragraph Type="Action"><Text>A </Text><Text TagNumber="4">pickup truck</Text><Text> idles.</Text></Paragraph>
    <Paragraph Type="Action"><Text TagNumber="5">Not in the ReWriter script.</Text></Paragraph>
  </Content>
  <TagData>
    <TagCategories>
      <TagCategory Id="c-cast" Name="Cast Members" Number="1" Color="#FF0000" Style="Bold"/>
      <TagCategory Id="c-props" Name="Props" Number="5" Color="#800080" Style=""/>
      <TagCategory Id="c-veh" Name="Vehicles" Number="4" Color="#FF00FF" Style=""/>
      <TagCategory Id="c-set" Name="Set" Number="23" Color="#000000" Style=""/>
      <TagCategory Id="c-loc" Name="Location" Number="28" Color="#000000" Style=""/>
    </TagCategories>
    <TagDefinitions>
      <TagDefinition Id="d-maya" CatId="c-cast" Label="MAYA" Number="1"/>
      <TagDefinition Id="d-key" CatId="c-props" Label="Silver Key" Number="2"/>
      <TagDefinition Id="d-truck" CatId="c-veh" Label="Pickup Truck" Number="3"/>
      <TagDefinition Id="d-set" CatId="c-set" Label="ROADSIDE DINER" Number="4"/>
      <TagDefinition Id="d-loc" CatId="c-loc" Label="Mel's on Route 9" Number="5"/>
      <TagDefinition Id="d-other" CatId="c-props" Label="Ghost Prop" Number="6"/>
    </TagDefinitions>
    <Tags>
      <Tag Number="1"><DefId>d-set</DefId><DefId>d-loc</DefId></Tag>
      <Tag Number="2"><DefId>d-maya</DefId></Tag>
      <Tag Number="3"><DefId>d-key</DefId></Tag>
      <Tag Number="4"><DefId>d-truck</DefId></Tag>
      <Tag Number="5"><DefId>d-other</DefId></Tag>
    </Tags>
  </TagData>
</FinalDraft>`;

const el = (id: string, type: ScreenplayElement['type'], text: string): ScreenplayElement => ({ id, type, content: [{ text }] });
const script = [
  el('h1', 'Scene Heading', 'INT. DINER - NIGHT'),
  el('a1', 'Action', 'MAYA slides a silver key across the counter.'),
  el('c1', 'Character', 'MAYA'),
  el('d1', 'Dialogue', 'Keep it.'),
  el('h2', 'Scene Heading', 'EXT. PARKING LOT - NIGHT'),
  el('a2', 'Action', 'A pickup truck idles.'),
];

describe('Final Draft tag import', () => {
  it('reads tag definitions, including runs with several definitions', () => {
    const data = readFdxTags(FDX);
    expect(data.definitionsByTag.get('1')!.map((d) => d.category)).toEqual(['Set', 'Location']);
    expect(data.paragraphs[1].runs[2]).toMatchObject({ text: 'silver key', start: 14, end: 24, tagNumber: '3' });
  });

  it('maps tags onto the script by scene, with offsets, and fills sheet fields', () => {
    const result = importFdxTags(readFdxTags(FDX), script);
    expect(result.tags.map((t) => [t.category, t.text, t.sceneId, t.sourceElementId, t.startOffset, t.endOffset])).toEqual([
      ['Cast Members', 'MAYA', 'h1', 'a1', 0, 4],
      ['Props', 'Silver Key', 'h1', 'a1', 14, 24],
      ['Cast Members', 'MAYA', 'h1', 'c1', 0, 4],
      ['Vehicles', 'Pickup Truck', 'h2', 'a2', 2, 14],
    ]);
    expect(result.sheets).toEqual({ h1: { set: 'ROADSIDE DINER', location: "Mel's on Route 9" } });
    expect(result.unmatchedParagraphs).toBe(1);
  });

  describe('store import', () => {
    const store = () => useScreenplayStore.getState();
    beforeEach(() => {
      store().resetToNew();
      useScreenplayStore.setState((s) => ({ screenplay: { ...s.screenplay, elements: script } }));
    });

    it('creates tags, master elements and sheet fields, and is safe to repeat', () => {
      const first = store().importFinalDraftTags(FDX);
      expect(first).toEqual({ tags: 4, elements: 3, sheets: 1, unmatched: 1 });
      const list = store().breakdown!.elementList!.map((e) => `${e.category}:${e.name}`).sort();
      expect(list).toEqual(['Cast Members:MAYA', 'Props:SILVER KEY', 'Vehicles:PICKUP TRUCK']);
      expect(store().breakdown!.sheets!.h1).toMatchObject({ set: 'ROADSIDE DINER' });
      expect(store().importFinalDraftTags(FDX)).toEqual({ tags: 0, elements: 0, sheets: 1, unmatched: 1 });
    });

    it('explains files without tags or that are not FDX', () => {
      expect(store().importFinalDraftTags('<FinalDraft><Content/></FinalDraft>')).toMatch(/no tags/);
      expect(store().importFinalDraftTags('not xml <')).toMatch(/not a valid Final Draft/);
    });
  });
});
