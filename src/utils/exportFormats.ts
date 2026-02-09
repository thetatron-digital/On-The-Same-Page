import type {
  Breakdown,
  ArtCart,
  ViewFinder,
  Schedule,
  SuperVisor,
  TakeEntry,
  StoryOutline,
} from '../types/screenplay';
import type { ProjectData } from '../types/user';
import { generateFDX } from './fdx';

// ============================================
// EXPORT FORMAT TYPES
// ============================================

export type ScreenplayExportFormat = 'fdx' | 'pdf';
export type BreakdownExportFormat = 'xml' | 'csv';
export type ScheduleExportFormat = 'xml' | 'mms' | 'csv';
export type ShotListExportFormat = 'xml' | 'csv' | 'pdf';
export type SupervisorExportFormat = 'xml' | 'csv' | 'ale'; // ALE for Avid Log Exchange

// OTSP (Open Television/Screenplay Project) archive contents
export interface OTSPManifest {
  version: string;
  projectName: string;
  createdAt: string;
  createdBy: string;
  files: OTSPFileEntry[];
}

export interface OTSPFileEntry {
  path: string;
  type: 'screenplay' | 'breakdown' | 'schedule' | 'shots' | 'supervisor' | 'artcart' | 'outline' | 'beatboard';
  format: string;
  description: string;
}

// ============================================
// XML GENERATION UTILITIES
// ============================================

const escapeXml = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';

// ============================================
// BREAKDOWN XML EXPORT
// ============================================

export const generateBreakdownXML = (breakdown: Breakdown): string => {
  let xml = xmlHeader;
  xml += `<Breakdown version="1.0" xmlns="http://rewriter.app/breakdown">\n`;
  xml += `  <Meta>\n`;
  xml += `    <Name>${escapeXml(breakdown.name)}</Name>\n`;
  xml += `    <ScriptVersion>${escapeXml(breakdown.scriptVersionId)}</ScriptVersion>\n`;
  xml += `    <CreatedAt>${breakdown.createdAt}</CreatedAt>\n`;
  xml += `    <UpdatedAt>${breakdown.updatedAt}</UpdatedAt>\n`;
  xml += `  </Meta>\n`;

  // Scenes
  xml += `  <Scenes>\n`;
  for (const scene of breakdown.scenes) {
    xml += `    <Scene id="${scene.id}">\n`;
    xml += `      <SceneNumber>${escapeXml(scene.sceneNumber)}</SceneNumber>\n`;
    xml += `      <IntExt>${scene.intExt}</IntExt>\n`;
    xml += `      <Location>${escapeXml(scene.location)}</Location>\n`;
    xml += `      <TimeOfDay>${escapeXml(scene.timeOfDay)}</TimeOfDay>\n`;
    xml += `      <DayNight>${scene.dayNight}</DayNight>\n`;
    xml += `      <Eighths>${scene.eighths}</Eighths>\n`;
    xml += `      <PageStart>${scene.pageStart}</PageStart>\n`;
    xml += `      <PageEnd>${scene.pageEnd}</PageEnd>\n`;
    xml += `      <Description>${escapeXml(scene.description)}</Description>\n`;
    if (scene.notes) {
      xml += `      <Notes>${escapeXml(scene.notes)}</Notes>\n`;
    }
    xml += `    </Scene>\n`;
  }
  xml += `  </Scenes>\n`;

  // Elements (tagged items)
  xml += `  <Elements>\n`;
  for (const element of breakdown.elements) {
    xml += `    <Element id="${element.id}" sceneId="${element.sceneId}">\n`;
    xml += `      <Text>${escapeXml(element.text)}</Text>\n`;
    xml += `      <Category>${escapeXml(element.category)}</Category>\n`;
    xml += `      <SourceElementId>${element.sourceElementId}</SourceElementId>\n`;
    xml += `      <StartOffset>${element.startOffset}</StartOffset>\n`;
    xml += `      <EndOffset>${element.endOffset}</EndOffset>\n`;
    if (element.notes) {
      xml += `      <Notes>${escapeXml(element.notes)}</Notes>\n`;
    }
    xml += `    </Element>\n`;
  }
  xml += `  </Elements>\n`;

  // Cast
  xml += `  <Cast>\n`;
  for (const cast of breakdown.castList) {
    xml += `    <CastMember id="${cast.id}">\n`;
    xml += `      <CharacterName>${escapeXml(cast.characterName)}</CharacterName>\n`;
    if (cast.actorName) {
      xml += `      <ActorName>${escapeXml(cast.actorName)}</ActorName>\n`;
    }
    xml += `      <Role>${cast.role}</Role>\n`;
    xml += `      <Scenes>${cast.sceneIds.join(',')}</Scenes>\n`;
    if (cast.workDays) {
      xml += `      <WorkDays>${cast.workDays}</WorkDays>\n`;
    }
    xml += `    </CastMember>\n`;
  }
  xml += `  </Cast>\n`;

  // Locations
  xml += `  <Locations>\n`;
  for (const loc of breakdown.locationsList) {
    xml += `    <Location id="${loc.id}">\n`;
    xml += `      <Name>${escapeXml(loc.name)}</Name>\n`;
    if (loc.address) {
      xml += `      <Address>${escapeXml(loc.address)}</Address>\n`;
    }
    xml += `      <IntExt>${loc.intExt}</IntExt>\n`;
    xml += `      <Scenes>${loc.sceneIds.join(',')}</Scenes>\n`;
    if (loc.notes) {
      xml += `      <Notes>${escapeXml(loc.notes)}</Notes>\n`;
    }
    xml += `    </Location>\n`;
  }
  xml += `  </Locations>\n`;

  // Custom Categories
  if (breakdown.customCategories.length > 0) {
    xml += `  <CustomCategories>\n`;
    for (const cat of breakdown.customCategories) {
      xml += `    <Category id="${cat.id}">\n`;
      xml += `      <Name>${escapeXml(cat.name)}</Name>\n`;
      xml += `      <Color>${cat.color}</Color>\n`;
      if (cat.description) {
        xml += `      <Description>${escapeXml(cat.description)}</Description>\n`;
      }
      xml += `    </Category>\n`;
    }
    xml += `  </CustomCategories>\n`;
  }

  xml += `</Breakdown>\n`;
  return xml;
};

// ============================================
// SCHEDULE XML EXPORT (Similar to Movie Magic format)
// ============================================

export const generateScheduleXML = (schedule: Schedule): string => {
  let xml = xmlHeader;
  xml += `<Schedule version="1.0" xmlns="http://rewriter.app/schedule">\n`;
  xml += `  <Meta>\n`;
  xml += `    <ProjectName>${escapeXml(schedule.projectName)}</ProjectName>\n`;
  xml += `    <TotalShootDays>${schedule.totalShootDays}</TotalShootDays>\n`;
  if (schedule.startDate) {
    xml += `    <StartDate>${schedule.startDate}</StartDate>\n`;
  }
  if (schedule.estimatedEndDate) {
    xml += `    <EstimatedEndDate>${schedule.estimatedEndDate}</EstimatedEndDate>\n`;
  }
  xml += `    <DefaultCallTime>${schedule.defaultCallTime}</DefaultCallTime>\n`;
  xml += `    <DefaultLunchDuration>${schedule.defaultLunchDuration}</DefaultLunchDuration>\n`;
  xml += `    <CreatedAt>${schedule.createdAt}</CreatedAt>\n`;
  xml += `  </Meta>\n`;

  // Strips
  xml += `  <Strips>\n`;
  for (const strip of schedule.strips) {
    xml += `    <Strip id="${strip.id}">\n`;
    xml += `      <SceneId>${strip.sceneId}</SceneId>\n`;
    xml += `      <SceneNumber>${escapeXml(strip.sceneNumber)}</SceneNumber>\n`;
    xml += `      <IntExt>${strip.intExt}</IntExt>\n`;
    xml += `      <Location>${escapeXml(strip.location)}</Location>\n`;
    xml += `      <TimeOfDay>${escapeXml(strip.timeOfDay)}</TimeOfDay>\n`;
    xml += `      <Description>${escapeXml(strip.description)}</Description>\n`;
    xml += `      <PageCount>${strip.pageCount}</PageCount>\n`;
    xml += `      <Color>${strip.color}</Color>\n`;
    xml += `      <Cast>${strip.castIds.join(',')}</Cast>\n`;
    xml += `      <CastNumbers>${strip.castNumbers.join(',')}</CastNumbers>\n`;
    if (strip.scheduledDayId) {
      xml += `      <ScheduledDayId>${strip.scheduledDayId}</ScheduledDayId>\n`;
      xml += `      <OrderInDay>${strip.orderInDay}</OrderInDay>\n`;
    }
    xml += `      <IsLocked>${strip.isLocked}</IsLocked>\n`;
    xml += `      <HasStunts>${strip.hasStunts}</HasStunts>\n`;
    xml += `      <HasVFX>${strip.hasVFX}</HasVFX>\n`;
    xml += `      <HasSpecialEquipment>${strip.hasSpecialEquipment}</HasSpecialEquipment>\n`;
    if (strip.notes) {
      xml += `      <Notes>${escapeXml(strip.notes)}</Notes>\n`;
    }
    xml += `    </Strip>\n`;
  }
  xml += `  </Strips>\n`;

  // Shoot Days
  xml += `  <ShootDays>\n`;
  for (const day of schedule.shootDays) {
    xml += `    <ShootDay id="${day.id}">\n`;
    xml += `      <DayNumber>${day.dayNumber}</DayNumber>\n`;
    if (day.date) {
      xml += `      <Date>${day.date}</Date>\n`;
    }
    xml += `      <Strips>${day.strips.join(',')}</Strips>\n`;
    xml += `      <CallTime>${day.callTime}</CallTime>\n`;
    xml += `      <EstimatedWrap>${day.estimatedWrap}</EstimatedWrap>\n`;
    if (day.lunchTime) {
      xml += `      <LunchTime>${day.lunchTime}</LunchTime>\n`;
    }
    if (day.lunchDuration) {
      xml += `      <LunchDuration>${day.lunchDuration}</LunchDuration>\n`;
    }
    if (day.location) {
      xml += `      <Location>${escapeXml(day.location)}</Location>\n`;
    }
    if (day.locationAddress) {
      xml += `      <LocationAddress>${escapeXml(day.locationAddress)}</LocationAddress>\n`;
    }
    xml += `      <IsLocked>${day.isLocked}</IsLocked>\n`;
    xml += `      <HasNightWork>${day.hasNightWork}</HasNightWork>\n`;
    if (day.notes) {
      xml += `      <Notes>${escapeXml(day.notes)}</Notes>\n`;
    }
    xml += `    </ShootDay>\n`;
  }
  xml += `  </ShootDays>\n`;

  // DOOD (Day Out of Days)
  if (schedule.dood.length > 0) {
    xml += `  <DOOD>\n`;
    for (const entry of schedule.dood) {
      xml += `    <Entry castId="${entry.castId}">\n`;
      xml += `      <CastName>${escapeXml(entry.castName)}</CastName>\n`;
      xml += `      <CharacterName>${escapeXml(entry.characterName)}</CharacterName>\n`;
      xml += `      <DayStatuses>\n`;
      for (const status of entry.dayStatuses) {
        xml += `        <Day dayId="${status.dayId}" dayNumber="${status.dayNumber}" status="${status.status}" />\n`;
      }
      xml += `      </DayStatuses>\n`;
      xml += `    </Entry>\n`;
  }
    xml += `  </DOOD>\n`;
  }

  xml += `</Schedule>\n`;
  return xml;
};

// ============================================
// SHOT LIST XML EXPORT
// ============================================

export const generateShotListXML = (viewFinder: ViewFinder): string => {
  let xml = xmlHeader;
  xml += `<ViewFinder version="1.0" xmlns="http://rewriter.app/viewfinder">\n`;
  xml += `  <Meta>\n`;
  xml += `    <ProjectName>${escapeXml(viewFinder.projectName)}</ProjectName>\n`;
  xml += `    <CreatedAt>${viewFinder.createdAt}</CreatedAt>\n`;
  xml += `    <UpdatedAt>${viewFinder.updatedAt}</UpdatedAt>\n`;
  xml += `  </Meta>\n`;

  // Camera Packages
  if (viewFinder.cameraPackages.length > 0) {
    xml += `  <CameraPackages>\n`;
    for (const pkg of viewFinder.cameraPackages) {
      xml += `    <Package id="${pkg.id}">\n`;
      xml += `      <Name>${escapeXml(pkg.name)}</Name>\n`;
      xml += `      <Cameras>${pkg.cameras.map(c => escapeXml(c)).join(',')}</Cameras>\n`;
      xml += `      <Lenses>${pkg.lenses.map(l => escapeXml(l)).join(',')}</Lenses>\n`;
      xml += `      <Support>${pkg.support.map(s => escapeXml(s)).join(',')}</Support>\n`;
      if (pkg.notes) {
        xml += `      <Notes>${escapeXml(pkg.notes)}</Notes>\n`;
      }
      xml += `    </Package>\n`;
    }
    xml += `  </CameraPackages>\n`;
  }

  // Shots
  xml += `  <Shots>\n`;
  for (const shot of viewFinder.shots) {
    xml += `    <Shot id="${shot.id}" sceneId="${shot.sceneId}">\n`;
    xml += `      <SceneNumber>${escapeXml(shot.sceneNumber)}</SceneNumber>\n`;
    xml += `      <ShotNumber>${escapeXml(shot.shotNumber)}</ShotNumber>\n`;
    xml += `      <Size>${shot.size}</Size>\n`;
    xml += `      <Angle>${escapeXml(shot.angle)}</Angle>\n`;
    xml += `      <Movement>${escapeXml(shot.movement)}</Movement>\n`;
    xml += `      <Subject>${escapeXml(shot.subject)}</Subject>\n`;
    xml += `      <Description>${escapeXml(shot.description)}</Description>\n`;
    if (shot.duration) {
      xml += `      <Duration>${shot.duration}</Duration>\n`;
    }
    xml += `      <Status>${shot.status}</Status>\n`;
    xml += `      <Priority>${shot.priority}</Priority>\n`;
    if (shot.equipment) {
      xml += `      <Equipment>\n`;
      if (shot.equipment.camera) {
        xml += `        <Camera>${escapeXml(shot.equipment.camera)}</Camera>\n`;
      }
      if (shot.equipment.lens) {
        xml += `        <Lens focalLength="${escapeXml(shot.equipment.lens.focalLength)}"`;
        if (shot.equipment.lens.aperture) {
          xml += ` aperture="${escapeXml(shot.equipment.lens.aperture)}"`;
        }
        xml += ` />\n`;
      }
      if (shot.equipment.support) {
        xml += `        <Support>${escapeXml(shot.equipment.support)}</Support>\n`;
      }
      xml += `      </Equipment>\n`;
    }
    if (shot.directorNotes) {
      xml += `      <DirectorNotes>${escapeXml(shot.directorNotes)}</DirectorNotes>\n`;
    }
    if (shot.dpNotes) {
      xml += `      <DPNotes>${escapeXml(shot.dpNotes)}</DPNotes>\n`;
    }
    xml += `    </Shot>\n`;
  }
  xml += `  </Shots>\n`;

  // Scene Coverage
  if (viewFinder.sceneCoverage.length > 0) {
    xml += `  <SceneCoverage>\n`;
    for (const cov of viewFinder.sceneCoverage) {
      xml += `    <Scene sceneId="${cov.sceneId}" sceneNumber="${escapeXml(cov.sceneNumber)}">\n`;
      xml += `      <ShotCount>${cov.shotCount}</ShotCount>\n`;
      xml += `      <CompletedShots>${cov.completedShots}</CompletedShots>\n`;
      xml += `      <EstimatedDuration>${cov.estimatedDuration}</EstimatedDuration>\n`;
      xml += `      <CoverageComplete>${cov.coverageComplete}</CoverageComplete>\n`;
      if (cov.notes) {
        xml += `      <Notes>${escapeXml(cov.notes)}</Notes>\n`;
      }
      xml += `    </Scene>\n`;
    }
    xml += `  </SceneCoverage>\n`;
  }

  xml += `</ViewFinder>\n`;
  return xml;
};

// ============================================
// SUPERVISOR XML/ALE EXPORT
// ============================================

export const generateSupervisorXML = (superVisor: SuperVisor): string => {
  let xml = xmlHeader;
  xml += `<SuperVisor version="1.0" xmlns="http://rewriter.app/supervisor">\n`;

  // Sessions
  xml += `  <Sessions>\n`;
  for (const session of superVisor.sessions) {
    xml += `    <Session id="${session.id}" shootDayId="${session.shootDayId}">\n`;
    xml += `      <Date>${session.date}</Date>\n`;
    xml += `      <TotalSetups>${session.totalSetups}</TotalSetups>\n`;
    xml += `      <TotalTakes>${session.totalTakes}</TotalTakes>\n`;
    xml += `      <TotalPrints>${session.totalPrints}</TotalPrints>\n`;

    // Takes
    xml += `      <Takes>\n`;
    for (const take of session.takes) {
      xml += `        <Take id="${take.id}">\n`;
      xml += `          <SceneNumber>${escapeXml(take.sceneNumber)}</SceneNumber>\n`;
      xml += `          <ShotId>${take.shotId}</ShotId>\n`;
      xml += `          <ShotNumber>${escapeXml(take.shotNumber)}</ShotNumber>\n`;
      xml += `          <TakeNumber>${take.takeNumber}</TakeNumber>\n`;
      xml += `          <Camera>${escapeXml(take.camera)}</Camera>\n`;
      if (take.timecodeIn) {
        xml += `          <TimecodeIn>${take.timecodeIn}</TimecodeIn>\n`;
      }
      if (take.timecodeOut) {
        xml += `          <TimecodeOut>${take.timecodeOut}</TimecodeOut>\n`;
      }
      if (take.duration) {
        xml += `          <Duration>${take.duration}</Duration>\n`;
      }
      xml += `          <Circled>${take.circled}</Circled>\n`;
      xml += `          <Rating>${take.rating}</Rating>\n`;
      if (take.directorNotes) {
        xml += `          <DirectorNotes>${escapeXml(take.directorNotes)}</DirectorNotes>\n`;
      }
      if (take.editorNotes) {
        xml += `          <EditorNotes>${escapeXml(take.editorNotes)}</EditorNotes>\n`;
      }
      if (take.technicalNotes) {
        xml += `          <TechnicalNotes>${escapeXml(take.technicalNotes)}</TechnicalNotes>\n`;
      }
      if (take.continuityNotes) {
        xml += `          <ContinuityNotes>${escapeXml(take.continuityNotes)}</ContinuityNotes>\n`;
      }
      if (take.screenDirection) {
        xml += `          <ScreenDirection>${take.screenDirection}</ScreenDirection>\n`;
      }
      xml += `          <CreatedAt>${take.createdAt}</CreatedAt>\n`;
      xml += `        </Take>\n`;
    }
    xml += `      </Takes>\n`;

    if (session.notes) {
      xml += `      <Notes>${escapeXml(session.notes)}</Notes>\n`;
    }
    xml += `    </Session>\n`;
  }
  xml += `  </Sessions>\n`;

  // Continuity Logs
  if (superVisor.continuityLogs.length > 0) {
    xml += `  <ContinuityLogs>\n`;
    for (const log of superVisor.continuityLogs) {
      xml += `    <Log id="${log.id}" sceneId="${log.sceneId}">\n`;
      xml += `      <SceneNumber>${escapeXml(log.sceneNumber)}</SceneNumber>\n`;
      xml += `      <Wardrobe>${escapeXml(log.wardrobeNotes)}</Wardrobe>\n`;
      xml += `      <Props>${escapeXml(log.propsNotes)}</Props>\n`;
      xml += `      <HairMakeup>${escapeXml(log.hairMakeupNotes)}</HairMakeup>\n`;
      xml += `      <Action>${escapeXml(log.actionNotes)}</Action>\n`;
      xml += `    </Log>\n`;
    }
    xml += `  </ContinuityLogs>\n`;
  }

  xml += `</SuperVisor>\n`;
  return xml;
};

// Generate Avid Log Exchange (ALE) format for editor import
export const generateALE = (takes: TakeEntry[]): string => {
  let ale = 'Heading\n';
  ale += 'FIELD_DELIM\tTABS\n';
  ale += 'VIDEO_FORMAT\t1080\n';
  ale += 'FPS\t24\n\n';

  ale += 'Column\n';
  ale += 'Name\tScene\tShot\tTake\tCamera\tCircled\tTimecode In\tTimecode Out\tDuration\tNotes\n\n';

  ale += 'Data\n';
  for (const take of takes) {
    const name = `${take.sceneNumber}_${take.shotNumber}_T${take.takeNumber}`;
    ale += `${name}\t${take.sceneNumber}\t${take.shotNumber}\t${take.takeNumber}\t${take.camera}\t`;
    ale += `${take.circled ? 'Y' : 'N'}\t${take.timecodeIn || ''}\t${take.timecodeOut || ''}\t`;
    ale += `${take.duration || ''}\t${take.editorNotes || ''}\n`;
  }

  return ale;
};

// ============================================
// ARTCART CSV EXPORT
// ============================================

export const generateArtCartCSV = (artCart: ArtCart): string => {
  let csv = 'Name,Category,Status,Priority,Quantity,Estimated Cost,Actual Cost,Vendor,Due Date,Notes\n';

  for (const item of artCart.items) {
    const row = [
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      `"${item.status}"`,
      `"${item.priority}"`,
      item.quantity,
      item.estimatedCost || '',
      item.actualCost || '',
      `"${item.vendorNotes?.replace(/"/g, '""') || ''}"`,
      item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '',
      `"${item.notes?.replace(/"/g, '""') || ''}"`,
    ];
    csv += row.join(',') + '\n';
  }

  return csv;
};

// ============================================
// STORY OUTLINE XML EXPORT
// ============================================

export const generateStoryOutlineXML = (outline: StoryOutline): string => {
  let xml = xmlHeader;
  xml += `<StoryOutline version="1.0" xmlns="http://rewriter.app/outline">\n`;

  // Plot Overview
  xml += `  <Plot>\n`;
  xml += `    <Title>${escapeXml(outline.plot.title)}</Title>\n`;
  xml += `    <Logline>${escapeXml(outline.plot.logline)}</Logline>\n`;
  xml += `    <Themes>${escapeXml(outline.plot.themes)}</Themes>\n`;
  xml += `    <StoryTypes>${outline.plot.storyTypes.map(t => escapeXml(t)).join(',')}</StoryTypes>\n`;
  xml += `    <Genres>${outline.plot.genres.map(g => escapeXml(g)).join(',')}</Genres>\n`;
  xml += `    <Tones>${outline.plot.tones.map(t => escapeXml(t)).join(',')}</Tones>\n`;
  xml += `    <Audience>${escapeXml(outline.plot.audience)}</Audience>\n`;
  xml += `    <Setting>${escapeXml(outline.plot.setting)}</Setting>\n`;
  xml += `    <BStory>${escapeXml(outline.plot.bStory)}</BStory>\n`;
  xml += `    <OtherDetails>${escapeXml(outline.plot.otherDetails)}</OtherDetails>\n`;
  xml += `  </Plot>\n`;

  // Characters
  xml += `  <Characters>\n`;
  for (const char of outline.characters) {
    xml += `    <Character id="${char.id}">\n`;
    xml += `      <Name>${escapeXml(char.name)}</Name>\n`;
    xml += `      <Role>${char.role}</Role>\n`;
    xml += `      <CharacterArc>${char.characterArc}</CharacterArc>\n`;
    xml += `      <Archetypes>${char.archetypes.join(',')}</Archetypes>\n`;
    xml += `      <PhysicalDescription>${escapeXml(char.physicalDescription)}</PhysicalDescription>\n`;
    xml += `      <Personality>${escapeXml(char.personality)}</Personality>\n`;
    xml += `      <Want>${escapeXml(char.want)}</Want>\n`;
    xml += `      <Need>${escapeXml(char.need)}</Need>\n`;
    xml += `      <Lie>${escapeXml(char.lie)}</Lie>\n`;
    xml += `      <Ghost>${escapeXml(char.ghost)}</Ghost>\n`;
    xml += `      <Notes>${escapeXml(char.notes)}</Notes>\n`;
    xml += `    </Character>\n`;
  }
  xml += `  </Characters>\n`;

  // Acts
  xml += `  <Acts>\n`;
  xml += `    <Act1>${escapeXml(outline.acts.act1)}</Act1>\n`;
  xml += `    <Act2A>${escapeXml(outline.acts.act2a)}</Act2A>\n`;
  xml += `    <Act2B>${escapeXml(outline.acts.act2b)}</Act2B>\n`;
  xml += `    <Act3>${escapeXml(outline.acts.act3)}</Act3>\n`;
  xml += `  </Acts>\n`;

  // Beats
  xml += `  <Beats>\n`;
  for (const beat of outline.beats) {
    xml += `    <Beat id="${beat.id}">\n`;
    xml += `      <Name>${escapeXml(beat.name)}</Name>\n`;
    xml += `      <Act>${beat.act}</Act>\n`;
    xml += `      <Description>${escapeXml(beat.description)}</Description>\n`;
    if (beat.pageTarget) {
      xml += `      <PageTarget>${beat.pageTarget}</PageTarget>\n`;
    }
    if (beat.linkedSceneId) {
      xml += `      <LinkedSceneId>${beat.linkedSceneId}</LinkedSceneId>\n`;
    }
    xml += `    </Beat>\n`;
  }
  xml += `  </Beats>\n`;

  xml += `</StoryOutline>\n`;
  return xml;
};

// ============================================
// OTSP PROJECT ARCHIVE GENERATION
// ============================================

export interface OTSPFile {
  name: string;
  content: string;
}

export const generateOTSPFiles = (projectData: ProjectData, projectName: string): OTSPFile[] => {
  const files: OTSPFile[] = [];
  const manifest: OTSPManifest = {
    version: '1.0',
    projectName: projectName,
    createdAt: new Date().toISOString(),
    createdBy: 'Re-writer',
    files: [],
  };

  // 1. Screenplay as FDX (industry standard)
  if (projectData.screenplay) {
    const fdxContent = generateFDX(projectData.screenplay);
    files.push({
      name: 'screenplay/screenplay.fdx',
      content: fdxContent,
    });
    manifest.files.push({
      path: 'screenplay/screenplay.fdx',
      type: 'screenplay',
      format: 'fdx',
      description: 'Final Draft XML screenplay file',
    });
  }

  // 2. Breakdown as XML
  if (projectData.breakdown) {
    const breakdownXML = generateBreakdownXML(projectData.breakdown);
    files.push({
      name: 'production/breakdown.xml',
      content: breakdownXML,
    });
    manifest.files.push({
      path: 'production/breakdown.xml',
      type: 'breakdown',
      format: 'xml',
      description: 'Script breakdown data',
    });
  }

  // 3. Schedule as XML
  if (projectData.schedule) {
    const scheduleXML = generateScheduleXML(projectData.schedule);
    files.push({
      name: 'production/schedule.xml',
      content: scheduleXML,
    });
    manifest.files.push({
      path: 'production/schedule.xml',
      type: 'schedule',
      format: 'xml',
      description: 'Production schedule and stripboard',
    });
  }

  // 4. ViewFinder/Shots as XML
  if (projectData.viewFinder) {
    const shotsXML = generateShotListXML(projectData.viewFinder);
    files.push({
      name: 'production/shots.xml',
      content: shotsXML,
    });
    manifest.files.push({
      path: 'production/shots.xml',
      type: 'shots',
      format: 'xml',
      description: 'Shot list and cinematography planning',
    });
  }

  // 5. SuperVisor as XML
  if (projectData.superVisor) {
    const supervisorXML = generateSupervisorXML(projectData.superVisor);
    files.push({
      name: 'production/supervisor.xml',
      content: supervisorXML,
    });
    manifest.files.push({
      path: 'production/supervisor.xml',
      type: 'supervisor',
      format: 'xml',
      description: 'Script supervisor logs and takes',
    });

    // Also generate ALE file for editor
    const allTakes = projectData.superVisor.sessions.flatMap(s => s.takes);
    if (allTakes.length > 0) {
      const aleContent = generateALE(allTakes);
      files.push({
        name: 'production/takes.ale',
        content: aleContent,
      });
      manifest.files.push({
        path: 'production/takes.ale',
        type: 'supervisor',
        format: 'ale',
        description: 'Avid Log Exchange file for editor',
      });
    }
  }

  // 6. ArtCart as CSV
  if (projectData.artCart) {
    const artCartCSV = generateArtCartCSV(projectData.artCart);
    files.push({
      name: 'production/artcart.csv',
      content: artCartCSV,
    });
    manifest.files.push({
      path: 'production/artcart.csv',
      type: 'artcart',
      format: 'csv',
      description: 'Art department sourcing list',
    });
  }

  // 7. Story Outline as XML
  if (projectData.storyOutline) {
    const outlineXML = generateStoryOutlineXML(projectData.storyOutline);
    files.push({
      name: 'development/outline.xml',
      content: outlineXML,
    });
    manifest.files.push({
      path: 'development/outline.xml',
      type: 'outline',
      format: 'xml',
      description: 'Story development outline',
    });
  }

  // 8. Beat Boards as JSON (no standard format exists)
  if (projectData.beatBoards && projectData.beatBoards.length > 0) {
    const beatBoardsJSON = JSON.stringify(projectData.beatBoards, null, 2);
    files.push({
      name: 'development/beatboards.json',
      content: beatBoardsJSON,
    });
    manifest.files.push({
      path: 'development/beatboards.json',
      type: 'beatboard',
      format: 'json',
      description: 'Visual beat boards',
    });
  }

  // Add manifest
  files.push({
    name: 'manifest.json',
    content: JSON.stringify(manifest, null, 2),
  });

  return files;
};

// Create OTSP archive as a downloadable blob
export const createOTSPArchive = async (
  projectData: ProjectData,
  projectName: string
): Promise<Blob> => {
  // Dynamically import JSZip
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const files = generateOTSPFiles(projectData, projectName);

  for (const file of files) {
    zip.file(file.name, file.content);
  }

  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};

// Download OTSP archive
export const downloadOTSP = async (
  projectData: ProjectData,
  projectName: string
): Promise<void> => {
  const blob = await createOTSPArchive(projectData, projectName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.otsp`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
