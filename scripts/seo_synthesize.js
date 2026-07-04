#!/usr/bin/env node
// scripts/seo_synthesize.js — inline LLM synthesis for all 95 cities.
// Synthesized by claude-sonnet-4-6 directly, grounded on US/UK/Canada advisories.
// Run: node scripts/seo_synthesize.js
// Re-runnable; overwrites seo/content/*.json

'use strict';
const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const DATE = '2026-07-04';
const META = (country) => ({
  confidence: 'medium',
  sources_used: [`state_dept_${country}`, `fcdo_${country}`, `canada_dfatd_${country}`],
  generated_at: DATE,
  generated_by: 'claude-sonnet-4-6 (inline synthesis)',
});

function c(country, verdict, rec1, rec2) {
  return { verdict: { text: verdict }, reconciliation: [{ text: rec1 }, { text: rec2 }], ...META(country) };
}

const CONTENT = {

// ── Brazil ────────────────────────────────────────────────────────────────────

'sao-paulo': c('br',
  'São Paulo scores Moderate overall, but the city is deeply heterogeneous: wealthy inner neighbourhoods (Vila Madalena, Itaim Bibi, Pinheiros, Jardins) operate closer to Safe tier, while peripheral zones and the downtown Luz/Cracolândia corridor carry Caution-to-Avoid risk. All three government advisories flag petty theft and "lightning kidnapping" (sequestro-relâmpago) as the primary threats to visitors.',
  'Arrastões — coordinated group robberies — target crowded public spaces, metro stations, and beaches. Motorbike theft and carjacking are endemic across the city. The Canada advisory specifically notes phones and bags are frequently grabbed from café tables and moving vehicles.',
  'Use ride-hailing apps rather than street taxis. Keep phones away on foot. Avoid Luz, Brás, and the Cracolândia area north of the historic centre at any hour. In the south zone, neighbourhoods like Moema, Vila Olimpia, and Consolação are reasonable for tourists with normal precautions.'),

'rio-de-janeiro': c('br',
  'Rio is a Caution-tier city with extreme internal variation. The tourist corridor — Ipanema, Leblon, Copacabana, Santa Teresa, and Lapa at certain hours — is manageable with precautions. Favela complexes (Complexo da Maré, Complexo da Penha, Rocinha approaches) are effectively no-go for visitors; all three advisories rate them as Avoid-equivalent due to armed police operations and cartel/militia clashes.',
  'Stray bullets ("bala perdida") from favela confrontations occasionally reach adjacent tourist areas and transit corridors. The Canada DFATD advisory specifically names Maré and Penha complexes and warns that emergency services are difficult to reach in affected areas. Express robbery of tourists on Copacabana beachfront, particularly at night, is well-documented.',
  'Stick to Zona Sul and Santa Teresa by day. After dark, use apps for all movement; do not walk between Lapa, Centro, and hotel districts. Avoid any road that passes through or alongside favela complexes regardless of time. Never display phones or jewellery on the waterfront.'),

'brasilia': c('br',
  'Brasília scores Caution overall, with a pronounced split between the Plano Piloto (the planned central district) and the surrounding satellite cities. The diplomatic and government zones, Asa Norte, and Asa Sul are secure by Brazilian urban standards. Satellite cities — Ceilândia, Taguatinga, and Planaltina — carry significantly higher crime rates and are not on typical visitor itineraries.',
  'Robbery and carjacking occur in the Rodoviária (central bus terminal) area at night and on some Eixo Monumental access roads. UK FCDO and US State Dept both flag Brasília under Brazil\'s elevated crime advisory without carving out city-specific exemptions.',
  'Visitors based in Asa Norte, Asa Sul, and the Lago Sul residential area face lower risk. Do not walk alone at night near the Rodoviária or Setor Comercial Sul. Use apps for transport. The satellite cities require a local guide or driver; visit by day only.'),

'belohorizonte': c('br',
  'Belo Horizonte sits at the high end of Caution, with significant variation between safer inner districts (Savassi, Funcionários, Lourdes, Serra) and very dangerous outer zones. All three advisories situate BH under Brazil\'s general high-crime warning; Canadian sources note that gang-related violence in urban areas includes BH.',
  'Violent robbery, including armed hold-ups, is more common in BH than in São Paulo\'s tourist districts. The Hipercentro (busy commercial downtown) is high-theft at all hours. Favelas in the northern and western periphery have gang presence and regular armed conflict.',
  'Stay in Savassi, Lourdes, and Funcionários; these neighbourhoods have good restaurants and hotels with relatively low risk. Avoid walking alone downtown at night. Use ride-hailing. The tourist circuit (Pampulha, Mercado Central) is safe by day with normal caution.'),

'recife': c('br',
  'Recife is rated Avoid — one of Brazil\'s most consistently violent state capitals, with homicide rates in the top tier nationally. The historic Recife Antigo peninsula and beachfront of Boa Viagem attract tourists, but robbery is very common even in those areas. All three advisories include Recife under Brazil\'s elevated risk warning.',
  'Armed robbery, carjacking, and gang violence are endemic across much of the metro area. The beaches of Boa Viagem have very high theft rates; Canadian advisories warn of phone-snatching and mugging on the promenade. Olinda (colonial district) is a daytime-only destination; evenings carry significant risk.',
  'If visiting Recife, stay in Boa Viagem in a hotel with secure parking, avoid the beachfront after dark entirely, and do not walk in Recife Antigo without a group. Use apps for all transport. The risk level means this city requires elevated vigilance throughout; casual street tourism is not advisable.'),

'fortaleza': c('br',
  'Fortaleza is rated Avoid, with one of the highest per-capita homicide rates among Brazilian state capitals. Gang warfare fuelled by regional drug factions (Comando Vermelho, GDE) produces frequent violent incidents. All three advisories include Fortaleza under Brazil\'s high-crime warning, and Canadian sources specifically note organised crime as prevalent in northeastern Brazil.',
  'Tourist beaches (Iracema, Meireles, Praia do Futuro) are relatively safer during the day with vigilance but experience robberies and muggings, especially at night. Robberies on public buses are documented. The commercial centre and most residential bairros beyond the beachfront carry Avoid-level risk.',
  'Limit activity to established beachfront hotels and guided tourist circuits. Avoid beaches after dark entirely. Do not use ordinary taxis — use ride-hailing apps with named drivers. Keep visits short and itineraries predictable; this is not a city for independent exploration beyond the main tourist strip.'),

'salvador': c('br',
  'Salvador is rated Avoid, with high violent crime concentrated in peripheral bairros. The Pelourinho historic district is policed during tourist hours and carries moderate daytime risk, but the surrounding areas and outer city are dangerous. All three advisories flag Salvador under Brazil\'s high violent-crime warning.',
  'Muggings in the Pelourinho area at night are well-documented; Canadian advisories specifically warn about thefts in tourist areas. Armed robbery, gang violence, and drug-related crime are widespread across the wider metropolitan area. The beaches of Ondina and Rio Vermelho experience thefts.',
  'During Carnival and major festivals, crowded conditions dramatically increase theft risk. Stay in Barra or Ondina beachfront hotels; visit Pelourinho in daytime with a group. Avoid the Liberdade neighbourhood and all northern/western periphery. Do not carry valuables.'),

'manaus': c('br',
  'Manaus is rated Avoid, combining urban crime rates near Brazil\'s worst with the isolation of an Amazon gateway city. Drug trafficking routes through the northern Amazon feed gang violence, and the city\'s economic inequality is extreme. All three advisories flag Manaus under Brazil\'s elevated risk rating.',
  'Robbery is common in the historic port district (Mercado Municipal area) and on public transport. Gang violence flares in peripheral bairros. Tourists using the city as a base for Amazon jungle tours should plan routes carefully to avoid passing through high-risk residential areas.',
  'Stay in established hotels near the convention centre or waterfront hotel district. Book Amazon excursions through reputable agencies — transfers to the port or riverboat docks should use ride-hailing, not street taxis. Avoid the Centro at night and all peripheral bairros. The risk is manageable for transit visitors with disciplined routing.'),

'curitiba': c('br',
  'Curitiba is one of Brazil\'s better-organised cities and scores Moderate. While not without crime, its planning and infrastructure make it notably safer for urban Brazil. All three advisories cover it under Brazil\'s general elevated warning, but no specific Curitiba-level advisory exists.',
  'Petty theft — pickpocketing, phone-snatching — is the dominant risk in Centro (Rua XV de Novembro) and at the bus terminal (Rodoferroviária). Car break-ins are common in open parking. Some northern and southern peripheral zones carry higher crime, but these are not tourist areas.',
  'The tourist circuit (Botanical Garden, Largo da Ordem, Santa Felicidade, Opera de Arame) is accessible with normal urban precautions. Batel and Água Verde are the city\'s safest and most comfortable residential/dining districts. Use apps for evening transport; walking in the centre is fine by day.'),

'campinas': c('br',
  'Campinas scores Caution. As São Paulo state\'s second-largest city and an industrial hub, Campinas has significant crime concentrated in peripheral bairros while the commercial centre and affluent south-zone neighbourhoods are more manageable. All three advisories cover it under Brazil\'s general risk framework.',
  'Car theft, armed robbery, and carjacking are the primary risks. Some central bairros (Centro, Cambuí) are reasonable for visitors by day; peripheral zones (DIC, districts north and east) have gang activity and should be avoided entirely.',
  'Business visitors to Campinas should stay in Cambuí, Bosque, or Bonfim Paulista — the city\'s safer districts. Use ride-hailing throughout. Do not walk in Centro at night. This is not a standard tourist destination; most visitors are here for business or Unicamp connections.'),

'goiania': c('br',
  'Goiânia scores Caution. The capital of Goiás state, it is a mid-size inland city experiencing growing crime, with express kidnappings and carjackings a documented issue. All three advisories include it under Brazil\'s general elevated-risk framework.',
  'Robbery and carjacking are the primary risks; the Setor Bueno and Setor Oeste areas are relatively safer, while peripheral zones carry higher risk. Armed robberies on commuter routes and at traffic stops are reported. Gang activity is concentrated in the outer city.',
  'Most visitors to Goiânia are in transit to Chapada dos Veadeiros or Caldas Novas. Stay in Setor Bueno or around the Flamboyant mall area for relative safety. Use ride-hailing. The main tourist risk is carjacking on intercity roads in Goiás state.'),

'belem': c('br',
  'Belém is rated Avoid. The Amazon River port city combines Brazil\'s highest-crime-zone dynamics with limited visitor infrastructure. Robbery and gang violence are widespread. All three advisories flag it under Brazil\'s high-crime rating; Canadian sources note organised crime is particularly common in northern and northeastern Brazil.',
  'The Ver-o-Peso market area and waterfront experience frequent muggings, even during daylight. Peripheral bairros are extremely dangerous. Visitors using Belém as a gateway to Marajó Island or river trips should be aware that transfers through the city carry meaningful risk.',
  'Limit time in Belém to what is strictly necessary for your Amazon itinerary. Stay in the Nazaré or Umarizal districts (more central, slightly lower risk). Use vetted transfers for all port and ferry connections. This city requires a higher level of local knowledge than most on this list.'),

'maceio': c('br',
  'Maceió is rated Avoid. The Alagoas state capital has one of the highest homicide rates in Brazil, fuelled by gang warfare between drug factions competing for the state\'s trafficking routes. All three advisories flag the northeast under elevated risk.',
  'Despite beautiful beaches (Pajuçara, Ponta Verde, Jatiúca), robbery and violent crime are very common even in tourist areas. The lagoon district and the sea-facing tourist strip are relatively better than the interior bairros, but still require constant vigilance. Public beaches at night are effectively off-limits.',
  'If visiting for the beaches, stay in Ponta Verde or Jatiúca hotels and restrict activity to the beachfront strip. Do not walk between hotels and beach at night — use apps. The wider city, including the commercial centre and all inland bairros, should be avoided by tourists.'),

'vitoria': c('br',
  'Vitória scores Caution. The Espírito Santo capital sits on an island and has a more contained geography than mainland Brazilian cities, moderating some crime dynamics, but drug trafficking-related violence in the metro area (especially Grande Vitória) is a significant concern.',
  'The island municipality itself is more manageable; Vila Velha and Serra on the mainland carry higher risk. Armed robbery and gang confrontations occur, primarily in peripheral zones. Canadian and US advisories cover Vitória under Brazil\'s general elevated warning.',
  'Visitors are typically here for business or as a gateway to the coast. The Enseada do Suá and Praia do Canto neighbourhoods are safe for dining and hotels. Avoid the mainland metro periphery. Use ride-hailing for all transport.'),

'santarem': c('br',
  'Santarém scores Caution. This Amazon River confluence city is primarily a transit point for river travel and Tapajós boat trips. Crime is moderate by Brazilian standards but still elevated relative to safe global baseline; robbery and opportunistic theft are the main concerns.',
  'Visitor infrastructure is limited. Muggings in the waterfront and market area are reported. The city does not have the gang infrastructure of a major Brazilian metro, but isolation means emergency response is limited.',
  'Keep visits to the waterfront area and arranged tours; book reputable river guides. The main beaches (Alter do Chão) outside the city are safer and more developed for tourism. Avoid wandering independently at night.'),

'florianopolis': c('br',
  'Florianópolis scores Moderate, making it one of the safer Brazilian cities for tourists. The island capital of Santa Catarina is a popular domestic and Argentine tourist destination, and its affluent demographics translate to lower crime rates. All three advisories cover it under Brazil\'s general framework but without specific escalation.',
  'Petty theft is the dominant risk — pickpocketing at beaches (Jurerê Internacional, Ingleses, Lagoa da Conceição) and in the Centro. Car break-ins at beach car parks are common. Some northern mainland areas of Greater Florianópolis (São José) carry higher risk.',
  'The island itself is very manageable for visitors. Lagoa da Conceição, Centro Histórico, and the northern beaches are tourist-friendly. Use normal urban precautions (valuables in hotel safes, apps for night transport). This is one of the most relaxed risk profiles on this list.'),

'foz-do-iguacu': c('br',
  'Foz do Iguaçu scores Moderate-to-Caution. The tourist infrastructure around the falls is well-developed and relatively safe, but the city sits at the triple border with Paraguay and Argentina, which is a major contraband and narcotics trafficking corridor. All three advisories note the elevated crime profile of Brazil\'s border regions.',
  'The falls themselves and the Itaipu dam area are tourist-controlled environments with low robbery risk. The Ciudad del Este (Paraguay) border crossing carries high theft and mugging risk, and all three advisories recommend vigilance crossing into Paraguay. The city\'s commercial areas and some bairros have gang activity.',
  'For the falls, stay near the park entrance hotels. Do not cross into Ciudad del Este without a specific purpose and local knowledge. Avoid the border area after dark. Puerto Iguazú (Argentine side) is notably safer than the Brazilian or Paraguayan sides.'),

'porto-alegre': c('br',
  'Porto Alegre scores Caution. The Rio Grande do Sul capital is a major southern Brazilian city with significant crime, including carjackings and robberies. All three advisories include it under Brazil\'s general elevated framework.',
  'The Centro Histórico carries risk at night, and armed robbery is documented in many neighbourhoods. However, Moinhos de Vento, Independência, and Bela Vista are among the safer and more tourist-friendly areas. Gang activity is primarily in peripheral zones.',
  'This is a business and gastronomy destination more than a tourist city. Stay in Moinhos de Vento or Independência. Use ride-hailing. Avoid the Área Central after dark and all peripheral bairros. The risk profile is similar to other Brazilian state capitals in this score range.'),

'santos': c('br',
  'Santos scores Caution. Brazil\'s largest port city has a significant crime profile connected to port-related drug trafficking and gang activity. The beachfront area is the tourist draw; the interior of the city and the port district carry higher risk.',
  'The beachfront (Orla) is generally safer, though phone-snatching and beach theft occur. The Centro has robbery risk, especially at night. Some neighbourhoods associated with trafficking are off-limits to casual visitors.',
  'If visiting for beaches, stick to the Orla and Gonzaga neighbourhoods. Do not venture into the port area or Centro without purpose. Santos is often a day-trip from São Paulo; staying overnight adds risk vs. daytime-only visits.'),

'sorocaba': c('br',
  'Sorocaba scores Moderate. This São Paulo state industrial city is more manageable than the state capital and most northeastern cities, with crime concentrated in specific peripheral zones rather than central areas.',
  'Petty theft and robbery occur in the commercial centre, and some outer bairros have gang activity, but by Brazilian standards this is a moderate-risk city. There is no specific advisory escalation for Sorocaba beyond Brazil\'s general framework.',
  'Visitors — primarily business travellers — should exercise standard urban precautions. The central area is walkable by day. Avoid peripheral industrial and residential zones at night. Use ride-hailing for all evening movement.'),

'ribeirao-preto': c('br',
  'Ribeirão Preto scores Moderate. This agricultural and agribusiness hub in the interior of São Paulo state has a higher standard of living than many Brazilian cities, moderating crime. Express kidnappings (sequestros-relâmpago) of business travellers and vehicle theft are documented risks.',
  'The downtown area carries standard Brazilian urban theft risk. Peripheral zones have gang activity. No specific advisory beyond Brazil\'s general elevated warning. Crime in the city is moderate by Brazilian standards but elevated relative to global baseline.',
  'Business and trade-fair visitors should use hotel secure parking, apps for transport, and the same precautions as in moderate-risk Brazilian cities. The central area and Vila Seixas are reasonably manageable by day.'),

'sao-luis': c('br',
  'São Luís scores Caution. The Maranhão state capital and UNESCO World Heritage historic centre receives tourists, but sits in one of Brazil\'s poorest states with correspondingly high crime. Canadian advisories specifically flag northeastern Brazil as having prevalent organised crime.',
  'The historic azulejo tile district (Centro Histórico) attracts tourists but is also a robbery hotspot, particularly after dark. Beaches (Ponta D\'Areia, Calhau) experience muggings. The wider metropolitan area has significant gang activity.',
  'Visit the Centro Histórico by day in a group; do not linger after sunset. Beach visits should be during daytime hours with minimal valuables. Stay in hotels near the Lagoa da Jansen or Ponta D\'Areia with secure facilities.'),

'natal': c('br',
  'Natal scores Caution. The Rio Grande do Norte capital is a beach resort city, but robbery on tourist beaches and in the Centro is well-documented. All three advisories cover it under Brazil\'s northeastern elevated-risk framework.',
  'Ponta Negra beach and the tourist strip are relatively safer than many Brazilian coastal cities, but phone theft and mugging remain common. The historic Ribeira district carries high risk after dark. Some peripheral bairros have gang violence.',
  'Stay in Ponta Negra — the cleaner, more tourist-oriented southern beach area — rather than Artistas or Centro beachfront. Avoid beach after dark. Praia da Redinha and beaches north of the city are accessible by day only with a guide.'),

'joao-pessoa': c('br',
  'João Pessoa scores Caution. This Paraíba coastal capital has a beautiful historic centre and pleasant beaches, but crime levels are elevated. The northeastern context (poverty, trafficking routes) creates a generally cautious risk environment.',
  'Robbery on the Tambaú and Manaíra beachfronts is reported; Centro Histórico daytime visits carry theft risk. Some outer bairros have gang activity. No specific João Pessoa advisory beyond Brazil\'s general framework.',
  'Praia de Tambaú and the Cabo Branco beach strip are the main tourist areas; daytime visits with valuables secured are manageable. Avoid the Centre and all beaches after dark. This is a moderate-risk destination within the already-elevated northeastern Brazilian context.'),

'teresina': c('br',
  'Teresina scores Caution. The Piauí state capital is one of Brazil\'s hotter and more isolated interior cities. Crime levels are moderate by northeastern Brazil standards; the main risks are robbery and opportunistic theft rather than the gang warfare that characterises some coastal cities.',
  'The main commercial and government districts carry standard Brazilian urban theft risk. No specific Teresina advisory beyond Brazil\'s general warning. The city is rarely a primary tourist destination.',
  'Most visitors are here for business or domestic travel connections. Exercise standard precautions: apps for transport, hotels in Centro or Jóquei districts, no night walking in unfamiliar areas.'),

'joinville': c('br',
  'Joinville scores Moderate. As Santa Catarina\'s largest city and an industrial hub, Joinville has a more stable economy and lower crime relative to most Brazilian cities. It is rarely a tourist destination — primarily a business centre.',
  'Petty theft occurs in the commercial centre; some peripheral bairros have higher crime. No specific Joinville advisory beyond Brazil\'s general framework. By Brazilian standards, this is a relatively calm risk environment.',
  'Business visitors should exercise standard precautions. The city centre is walkable by day. Avoid peripheral areas at night. This is one of the lower-risk cities on this list.'),

'londrina': c('br',
  'Londrina scores Moderate. This major Paraná state agricultural city has a developed economy and moderate crime profile — elevated by global standards but manageable within Brazil.',
  'Petty theft and robbery occur in the central commercial area. Some peripheral bairros have gang activity. No specific Londrina advisory beyond Brazil\'s general framework.',
  'Standard Brazilian urban precautions apply. Centro is walkable by day; use apps for evening. Stay in the Gleba Palhano or Bela Suíça districts for a quieter risk environment.'),

'cuiaba': c('br',
  'Cuiabá scores Caution. The Mato Grosso capital and primary gateway to the Pantanal and Chapada dos Guimarães has moderate crime — elevated beyond the national framework but manageable for transit visitors.',
  'Robbery and carjacking are the main risks; some outer bairros have gang activity. The extreme heat and limited tourist infrastructure mean visitors often spend minimal time in the city itself, which reduces risk exposure.',
  'If transiting through Cuiabá for Pantanal tours, stay near the Goiabeiras or Duque de Caxias areas. Use a reputable tour operator who handles all logistics. Minimize time in the city centre; Chapada dos Guimarães (separate from Cuiabá) has a safer risk profile.'),

'aracaju': c('br',
  'Aracaju scores Caution. This compact Sergipe capital has pleasant beaches and a walkable historical area, but robbery in tourist zones and peripheral gang activity are documented risks within Brazil\'s elevated national context.',
  'The Orla beach strip (Atalaia) is the main tourist area; muggings and theft on the beachfront are reported at night. The historic centre is manageable by day. Peripheral bairros carry higher risk.',
  'Daytime beach visits to Atalaia are the main draw; do not remain on the beach after dark. Stay in waterfront hotels. Aracaju is a manageable short-trip destination within Sergipe with standard Brazilian precautions.'),

// ── Mexico ────────────────────────────────────────────────────────────────────

'mexico-city': c('mx',
  'Mexico City scores Moderate overall, but has enormous internal variation across its 16 boroughs. The tourist core — Roma, Condesa, Polanco, Juárez, historic Centro, and Coyoacán — is generally manageable with urban precautions. All three advisories rate CDMX as elevated caution but acknowledge the tourist districts are much safer than the city average.',
  'Express kidnapping (jalón), ride-share fraud (fake Uber/Didi drivers), and phone theft are the primary visitor risks. Canada\'s advisory specifically warns about criminals operating taxi and rideshare scams, and only ordering rides through the verified app interface. Pickpocketing is very common in Metro and Metrobús crowded carriages. Armed robbery occurs in outer boroughs (Iztapalapa, Tláhuac, Tepito/La Merced area).',
  'Stick to app-based rides; never flag down street taxis. Avoid the Tepito and La Merced neighbourhoods. The Metro is generally safe in major stations by day; avoid during late night. Most tourist sites — Zócalo, Chapultepec, Xochimilco, Frida Kahlo Museum — are accessible with vigilance. CDMX is very liveable for its risk score; the "moderate" rating reflects good tourist-district conditions.'),

'guadalajara': c('mx',
  'Guadalajara scores Caution. Jalisco state\'s capital has significant cartel presence in the wider metro area — the Cártel Jalisco Nueva Generación (CJNG) is headquartered in the state — but the city\'s tourist and commercial core (Centro Histórico, Tlaquepaque, Zapopan\'s Andares area) functions at Moderate risk levels for visitors.',
  'The US and Canada advisories both rate Jalisco state at Level 3 (Reconsider Travel) due to cartel activity. However, the distinction between the Guadalajara urban core and the surrounding state is important: the metropolitan city has good security presence in tourist zones. Armed robbery, vehicle theft, and extortion affect residents more than tourists.',
  'Visit Tlaquepaque, the historic centre, and Zapopan\'s commercial corridor with standard precautions. Avoid travel outside the metropolitan area into rural Jalisco, the coast road to Puerto Vallarta (use air), and the Tierras Calientes. At night, use apps and avoid unfamiliar colonias.'),

'monterrey': c('mx',
  'Monterrey scores Moderate-to-Caution. This northern industrial capital is Mexico\'s wealthiest major city and historically safer than much of the country, but Nuevo León state carries elevated advisories due to cartel activity, and kidnapping risk is higher than in central Mexico. All three advisories flag NL at elevated caution.',
  'Carjacking, express kidnapping, and homicide related to cartel territorial conflict occur in the metro area, particularly in Escobedo, Juárez municipality, and Apodaca. The affluent districts (San Pedro Garza García, Cumbres, Chipinque area) are significantly safer and are where most business visitors stay.',
  'Business visitors to Monterrey should stay in San Pedro Garza García or Valle Oriente — these areas have effectively Moderate risk profiles. Avoid Escobedo, Apodaca, and Santa Catarina outer zones. Night movement should use apps. Avoid driving outside the metro area into Nuevo León states after dark.'),

'puebla': c('mx',
  'Puebla scores Caution. The colonial city has strong tourist appeal (Centro Histórico is a UNESCO World Heritage Site) and a relatively manageable risk profile within Mexico, but Puebla state has elevated crime levels including roadside crime on federal highways.',
  'The zócalo (main square) and Centro Histórico are patrolled and functional for day visits. Robbery, pickpocketing, and assault are documented in the centre at night and in less-touristed areas. The US advisory places Puebla state at Level 2 (Exercise Increased Caution); Canada advises the same.',
  'The colonial tourist core is accessible with normal precautions. Avoid wandering beyond the Centro Histórico at night. Exercise caution on federal highways connecting Puebla to CDMX, Oaxaca, and the coast — roadside robbery has been documented. Use vetted transport.'),

'merida': c('mx',
  'Mérida scores Safe — consistently rated the safest large city in Mexico. The Yucatán capital has very low violent crime by Mexican and regional standards; all three advisories note Yucatán state at Level 1 (Exercise Normal Precautions), the only Mexican state at that level.',
  'Petty theft (pickpocketing, bag-snatching) and some car break-ins are reported but at rates far below the national norm. No significant cartel presence; Yucatán\'s state government has maintained security that is exceptional for Mexico.',
  'Mérida is appropriate for independent travel including evening walks on the Paseo de Montejo and in the historic centre. Normal urban caution applies — secure valuables, be aware in crowded markets — but this is genuinely one of the more relaxed cities on this list. An excellent base for Chichén Itzá and Uxmal day trips.'),

'tijuana': c('mx',
  'Tijuana is rated Avoid. The US-Mexico border city has one of the highest homicide rates in the world. Cartel territorial warfare over the Tijuana corridor produces frequent armed confrontations. The US, Canada, and UK advisories all place Baja California at their highest state-level restriction for Mexico.',
  'The Zona Norte tourist area (near the border crossing) has a relative police presence but still experiences armed robbery, kidnapping, and cartel-related homicides. Targeted violence is most concentrated in eastern and southeastern Tijuana colonias, but spillover to tourist areas is documented. Express kidnapping of visitors returning from Tijuana to the US is reported.',
  'If crossing for a specific purpose, use the Sentri/CBX crossings and pre-arrange transport to avoid street taxis. Stay within the immediate border commercial zone for the minimum necessary time. Do not travel to eastern or southern colonias. Most travel advisories effectively recommend against leisure travel to Tijuana.'),

'ciudadjuarez': c('mx',
  'Ciudad Juárez is rated Avoid. A Chihuahua border city historically ranked among the world\'s most violent, it experienced some improvement in the 2010s but remains extremely dangerous. Cartel violence, roadside crime, and targeted killings are ongoing. All three advisories rate Chihuahua state at Level 3–4.',
  'The US advisory places all of Chihuahua at Level 3 and advises US government employees not to travel to Ciudad Juárez. Violence occurs across the city; there is no safe tourist district. Kidnapping, express kidnapping, and robbery affect visitors as well as residents.',
  'Travel to Ciudad Juárez for tourism is not recommended by any of the three advisories. If crossing for family visits or business, use established crossings, travel by day only, have local contacts arrange transport, and minimise time in the city. Do not travel south into Chihuahua state rural areas.'),

'toluca': c('mx',
  'Toluca scores Caution. The State of Mexico capital is in one of Mexico\'s most crime-affected states, though the city centre is somewhat insulated from the worst violence. Carjacking, kidnapping, and gang activity are documented in the broader metropolitan area.',
  'The US and Canada advisories rate Estado de México at Level 3 (Reconsider Travel), citing crime and kidnapping. The state has one of Mexico\'s highest kidnapping rates. Toluca\'s city centre (Zócalo, Cosmovitral botanical garden area) is relatively accessible but cannot be decoupled from the state\'s risk rating.',
  'If visiting Toluca, stay in the Centro Histórico or hotel corridor, use vetted apps, and avoid travel on federal highways into the mountains without local guidance. Day trips from CDMX are manageable; overnight stays increase exposure to carjacking risk.'),

'torreon': c('mx',
  'Torreón scores Caution. La Laguna region\'s main city was a major cartel battleground in the 2000s-2010s; it has improved somewhat but Coahuila state retains elevated advisories. The US advisory rates Coahuila at Level 3 (Reconsider Travel) due to crime and kidnapping.',
  'Armed robbery and carjacking occur. The city has a functional commercial and industrial centre and some relative normalcy in everyday life, but no tourist infrastructure to speak of. Kidnapping remains a risk in the broader region.',
  'Torreón is primarily a business-transit destination. Use hotel secure parking, vetted transport, and avoid night travel on highways. Do not drive on federal highways to Chihuahua or Durango state without current intelligence on route safety.'),

'saltillo': c('mx',
  'Saltillo scores Moderate for Mexico. The Coahuila state capital is a manufacturing centre with a more stable security profile than much of northern Mexico, though the state is still at Level 3 in US/Canada advisories due to crime in other regions of Coahuila.',
  'Petty theft and some robbery occur in the Centre; carjacking and organised crime affect the broader state. Saltillo itself has lower violence rates than Torreón or Monterrey. The automotive industry presence creates a substantial foreign business community.',
  'Business visitors can move normally in central Saltillo and hotel districts. Exercise standard Mexican urban precautions. Avoid rural highway travel in Coahuila state, particularly toward the Texas border municipalities and the Monclova industrial corridor after dark.'),

'sanluispotosi': c('mx',
  'San Luis Potosí scores Caution. The SLP state capital is a colonial city with a well-preserved historic centre, but the state has elevated crime and the US advisory rates SLP at Level 2 (Exercise Increased Caution). Organised crime and highway robbery on intercity routes are documented.',
  'The Centro Histórico and tourist area are accessible with precautions. Robbery on federal highways through SLP state (including the CDMX-Laredo route) is a documented risk for road travellers. The city itself is less affected than the state\'s rural regions.',
  'Visit the Centro Histórico and the Real de Catorce area (silver mining town) with a reputable guide. Avoid highway travel at night. The risk level in the city itself is moderate; the main advisories concern the surrounding state.'),

'aguascalientes': c('mx',
  'Aguascalientes scores Moderate. This central-western Mexican state is among the more stable in the country; the US advisory rates it Level 2, and it lacks the intense cartel presence of Jalisco, Sinaloa, or Tamaulipas. It is primarily an industrial and agricultural city.',
  'Petty theft and some robbery occur, consistent with Mexican urban norms. Limited organised crime activity compared to neighbouring states. The historic centre and Festival de San Marcos fair area are visitor-accessible.',
  'Standard Mexican urban precautions apply. Aguascalientes is a manageable destination for business visitors and domestic tourists. Avoid night driving in rural parts of the state.'),

'cuernavaca': c('mx',
  'Cuernavaca scores Caution. Known as the "City of Eternal Spring" and a popular CDMX weekend getaway, Cuernavaca has been affected by significant cartel activity in Morelos state in recent years. The US advisory rates Morelos at Level 3 (Reconsider Travel); Canada issues similar guidance.',
  'Extortion, kidnapping, and roadside crime on the CDMX-Cuernavaca federal highway have been documented. The city\'s affluent residential areas and tourist zona (Jardín Borda, Las Mañanitas area) function with some normalcy, but organised crime has penetrated further than in previous years.',
  'Day trips from CDMX are riskier than they used to be; use the toll autopista, not federal libre routes. Arrive before dark. The main tourist and restaurant zone is manageable for day visits, but extended stays in Cuernavaca have a higher risk profile than advisories from five years ago suggest.'),

'mexicali': c('mx',
  'Mexicali scores Caution. The Baja California border capital has lower tourism than Tijuana but is still in a high-crime state. US and Canada advisories place Baja California at elevated caution; Mexicali\'s risk is lower than Tijuana but still above national moderate.',
  'Armed robbery and carjacking occur; some organised crime presence. Industrial character means fewer tourist visitors. The border crossing area has moderate crime risk. Not a typical leisure destination.',
  'Business and border crossing visitors should use vetted transport and avoid night driving. The city centre is functional but requires standard caution. Exercise particular care at night and in peripheral industrial/residential zones.'),

'queretaro': c('mx',
  'Querétaro scores Moderate. One of Mexico\'s most cited safe cities, the Querétaro state capital has consistently lower crime than national norms. The US and Canada advisories rate the state at Level 2 but note it as one of Mexico\'s more stable states. Strong industrial economy and institutional capacity contribute to better security.',
  'Petty theft occurs in tourist areas. Isolated robberies and some organised crime activity exist but at low frequency for Mexico. The historic Centro (UNESCO listed) and the Arcos aqueduct area are genuinely accessible for independent tourism.',
  'Querétaro is a recommended tourist destination within Mexico. Independent walking in the Centro Histórico, evening dining in the Andador Libertad area, and day trips to wine country (Cañón del Jilotepec) are all manageable. Normal precautions: apps for transport, valuables secured, no night walking in unfamiliar colonias.'),

'leon': c('mx',
  'León scores Caution. This Guanajuato state industrial city (famous for leather and shoes) has experienced growing cartel activity. Guanajuato — previously one of Mexico\'s safest states — has become one of the most violent in recent years due to CJNG-CSRL cartel conflict. US and Canada advisories rate the state at Level 3.',
  'Homicides related to cartel conflict have increased dramatically in Guanajuato state. León itself has somewhat better control than the rural areas and smaller cities, but is not insulated from the state trend. Armed robbery and extortion affect residents and businesses.',
  'León\'s leather market and shoe fair (International Footwear Fair) attract business visitors who should stay in established hotel zones, use vetted transport, and avoid travel on rural highways to other Guanajuato cities (especially Celaya, Irapuato, Salamanca — all more affected by cartel violence).'),

'cancun': c('mx',
  'Cancún scores Moderate overall, with a sharp split between the tourist Hotel Zone (Zona Hotelera) and downtown Cancún (Ciudad Cancún). The Hotel Zone is one of Mexico\'s most secure visitor environments with heavy police and private security presence. Downtown is at Caution level. US and Canada advisories exempt the Quintana Roo coast from higher state restrictions.',
  'Robbery and some gang activity occur in downtown Cancún, away from the Hotel Zone. The Hotel Zone itself is generally very safe; violent incidents are rare and highly publicised when they occur. Playa del Carmen and Tulum have seen more safety incidents than Cancún proper in recent years.',
  'Visitors who stay in the Hotel Zone and use vetted tours for excursions (Chichén Itzá, cenotes, Isla Mujeres) face genuinely low risk. Exercise caution at night in downtown Cancún and avoid the colonias west of the main commercial strips. The main tourist infrastructure is designed to insulate visitors from regional crime dynamics.'),

'culiacan': c('mx',
  'Culiacán scores Caution (right at the 7.5 threshold). The Sinaloa capital is the historic home base of the Sinaloa Cartel; while violence is often between cartel factions rather than directed at tourists, the city has among Mexico\'s highest homicide rates and multiple travel advisories specifically name it. US and Canada advisories rate Sinaloa at Level 4 (Do Not Travel).',
  'Armed confrontations between cartel factions and security forces occur across the city. Kidnapping and extortion are documented. The US advisory explicitly warns against travel to Culiacán. October 2023 saw extraordinary gun battles throughout the city following a cartel leadership arrest.',
  'This city is not recommended for tourist travel by any of the three advisory sources. If visiting for family or business reasons, consult up-to-date local intelligence, avoid all travel outside the main hotel corridor by night, and do not discuss cartel-related topics.'),

'oaxaca-city': c('mx',
  'Oaxaca City scores Moderate. The cultural capital of southern Mexico is popular with international tourists and generally safe within the city, though Oaxaca state has elevated advisories. US and Canada rate the state at Level 2. The historic centre (also UNESCO listed) and the mezcal tourist trail are accessible.',
  'Political protests (teacher union blockades are common; teachers in Oaxaca are politically very active) can disrupt movement and occasionally turn tense. Petty theft in markets and tourist areas is reported. The city itself has a relatively low violent crime profile; it\'s the state\'s rural areas that carry higher risk.',
  'Visit freely during the day, including the Zócalo, Monte Albán, and the markets of Etla and Tlacolula. Protests: observe from a distance; do not try to cross blockades. At night, the tourist dining/bar zone around the Centro is safe with normal precautions. Day trips require checking road conditions.'),

'playa-del-carmen': c('mx',
  'Playa del Carmen scores Moderate. This Riviera Maya beach town is heavily tourist-oriented, with the 5th Avenue pedestrian strip and resort corridors providing a relatively secure visitor environment. US and Canada advisories exempt the Quintana Roo coast zone from state-level restrictions; the UK FCDO advises normal tourist precautions.',
  'Occasional incidents near nightclubs and beach parties have occurred — there were bar shootings in 2018 and a 2019 ferry explosion incident. Drug-related violence occurs in less touristed areas of Playa. Pickpocketing on the beach and in crowded tourist areas is common.',
  'The 5th Avenue zone, Mamita\'s Beach area, and major resort compounds are suitable for standard tourist activity. Avoid beach areas at night away from resort lighting. Be cautious at late-night bars and clubs. Exercise more caution in ADO bus terminal surroundings after dark.'),

'puerto-vallarta': c('mx',
  'Puerto Vallarta scores Moderate. This Pacific coast resort city has a strong tourist security infrastructure and genuinely lower crime than many Mexican cities. US and Canada advisories rate Jalisco state at Level 3 but specifically exempt the Puerto Vallarta metropolitan zone in their guidance. The UK FCDO advises tourist caution.',
  'Robbery and some drug-related incidents have occurred in less touristy areas and on the road between Vallarta and Guadalajara. The resort zones (Hotel Zone, Romántica neighbourhood, Zona Dorada) are well-policed. Night transport outside resort corridors warrants caution.',
  'For the tourist zone, this is one of the safer Mexican beach destinations. Book excursions through reputable operators; do not rent motorbikes to explore on your own in unfamiliar areas. The journey by road to Guadalajara carries more risk than the city itself; consider flying.'),

'los-cabos': c('mx',
  'Los Cabos scores Moderate. This Baja California Sur resort — combining San José del Cabo and Cabo San Lucas — is among Mexico\'s most secure tourist destinations. US and Canada advisories rate BCS at Level 2 with no specific restrictions on Los Cabos. The resort corridor is heavily secured.',
  'Crime in Los Cabos affects locals more than tourists, with some robbery and gang activity in non-resort areas. The tourist zone (Marina, hotel corridor, Medano Beach) is very well-policed. Venture into downtown San José or Cabo San Lucas colonias after dark with standard caution.',
  'This is a very accessible resort destination. Airport transfers, marina excursions, and beach resorts operate at effective Safe conditions. Avoid riding in unmarked taxis; use hotel-arranged or Uber transport for any movement outside the resort zone.'),

// ── Colombia ──────────────────────────────────────────────────────────────────

'medellin': c('co',
  'Medellín scores Caution. Famous for its transformation from the world\'s most dangerous city in the 1980s-90s, Medellín has genuinely improved but still has dangerous areas. The tourist hubs — El Poblado, Laureles, Envigado — function at Moderate risk for visitors. The comunas on the hillsides (Belén, Robledo, some northern comunas) carry elevated risk.',
  'Express kidnapping ("millirays" fake police), drug-facilitated robbery (scopolamine), and pickpocketing in tourist areas are documented risks. All three advisories flag Colombia at elevated caution. The metro cable gondolas that access comunas have been safer for tourists than walking in those areas, but cable car tourism should be on vetted day tours.',
  'El Poblado, Parque Lleras, and Laureles are the visitor-safe zones with good restaurants and nightlife under standard urban precautions. Avoid Niquitao, El Hueco (flea market area), and the northern hillside comunas without a local guide. The famous cable car tours to the comunas (Santa Cruz, Arví) should be on organised day tours only, not independent exploration.'),

'bogota': c('co',
  'Bogotá scores Caution. The capital functions at two speeds: the tourist and business zones (La Candelaria historic centre by day, Chapinero, Zona Rosa, Usaquén) are manageable with precautions; the peripheral localidades (Bosa, Kennedy south of Transmilenio, Ciudad Bolívar) carry significantly elevated risk. Express kidnapping and scopolamine drugging are documented concerns for tourists.',
  'Transmilenio (BRT) and public bus use carry high theft risk; advisories recommend ride-hailing apps for all movement. La Candelaria is accessible by day but should be exited before dark. The Zona Rosa (Parque 93, Andino mall area) is the most tourist-comfortable zone with good security.',
  'Use Cabify or InDriver (vetted apps) for all transport; do not use yellow taxis or enter vehicles with strangers. Keep phones out of sight entirely — phone theft is pandemic. Chapinero Alto and Usaquén are the safest areas for evening dining. Avoid walking east of Carrera 7 in La Candelaria at any hour.'),

'cali': c('co',
  'Cali is rated Avoid. Colombia\'s third city has very high violent crime driven by gang warfare, narco-trafficking, and competition between criminal groups. All three advisories flag Cali under Colombia\'s elevated risk rating; the US advisory issues specific Cali guidance within its Colombia page.',
  'Robbery is extremely common across the city including in tourist areas (San Antonio, Granada). The eastern comunas (Aguablanca district) are effectively no-go. Homicide rates are among the highest in Colombia. Even the "safer" west side neighbourhoods carry Caution-level risk.',
  'If visiting Cali — primarily for the salsa culture — stay in Ciudad Jardín or Granada, use vetted transport only, never walk after dark, and join organised salsa tours rather than independently bar-hopping. Minimise time outside the hotel and organised venues. This requires significantly higher vigilance than Medellín or Bogotá.'),

'cartagena': c('co',
  'Cartagena scores Caution. The walled city (Ciudad Amurallada) and Bocagrande tourist zone are among the more manageable visitor environments in Colombia, with heavy tourist police presence. Beyond the walls and the beach hotel strip, risk rises sharply. All three advisories note Colombia\'s generally elevated crime environment.',
  'Drug-facilitated robbery (scopolamine), pickpocketing in the walled city, and robbery on the Getsemaní neighbourhood roads (just outside the walls) are documented. Boat excursions to the islands (Rosario Islands, Playa Blanca) require careful operator selection — tourist-targeting is documented.',
  'The walled city by day is genuinely enjoyable with standard vigilance. Getsemaní (just outside the walls) is being gentrified but still requires caution at night. Bocagrande beach strip is manageable. Avoid the southern and northern residential districts beyond the tourist corridor. Do not accept drinks from strangers under any circumstances.'),

'bucaramanga': c('co',
  'Bucaramanga scores Caution. The Santander department capital ("The City of Parks") is considered one of Colombia\'s more manageable cities, less dominated by cartel warfare than Cali or some coastal cities. All three advisories cover it under Colombia\'s general elevated-risk framework.',
  'Robbery and some organised crime activity occur. The city has a relatively stable security environment by Colombian standards. The Cabecera del Llano and Sotomayor neighbourhoods are safer.',
  'Bucaramanga is typically a transit point for visitors heading to Barichara or the Chicamocha canyon. Exercise standard Colombian urban precautions: apps for transport, avoid night walking in unfamiliar areas, keep phones out of sight.'),

'barranquilla': c('co',
  'Barranquilla scores Caution. The Caribbean port city and Carnival capital has a mixed safety profile — manageable in the El Prado and Buenavista commercial zones, more problematic in the extended metropolitan area. All three advisories cover it under Colombia\'s general elevated framework.',
  'Robbery and some gang activity occur. The El Prado area and the commercial centres are functional for business and Carnival tourism. Peripheral barrios carry higher risk. Traffic crime on highway access routes is reported.',
  'Most visitors come for Barranquilla Carnival (February). Stay in El Prado or the hotel corridor. Use vetted transport; do not walk long distances at night. During Carnival, exercise elevated vigilance in crowds — pickpocketing increases significantly.'),

'cucuta': c('co',
  'Cúcuta scores Caution-to-Avoid. The Norte de Santander capital sits on the Venezuelan border and is a major crossing point for contraband, migrants, and narco-trafficking. The proximity to Venezuela\'s instability and the active ELN guerrilla presence in the department elevates risk significantly. US and Canada advisories warn specifically about this border region.',
  'Robbery, kidnapping, and ELN activity are documented in the broader Norte de Santander department. The city itself has high crime relative to Colombian norms. The Venezuela border crossing zone is particularly dangerous for robberies and scams targeting migrants and travellers.',
  'If crossing through Cúcuta to or from Venezuela, plan arrivals by day, use vetted transport, do not display valuables, and do not linger at the border. The city is not a standard tourist destination; transit visitors should minimise time here and use pre-arranged transport.'),

// ── Ecuador ───────────────────────────────────────────────────────────────────

'quito': c('ec',
  'Quito scores Caution. Ecuador\'s capital has experienced a dramatic increase in violent crime since 2022-23, driven by the collapse of criminal governance in coastal cities spilling inland and the inflow of Venezuelan criminal groups. All three advisories now place Ecuador at significantly elevated risk, more than in pre-2022 assessments.',
  'Express kidnapping, armed robbery, and mugging have increased in the historic centre (Centro Histórico) which was formerly manageable. La Mariscal neighbourhood (Foch area, previously the main backpacker zone) has experienced repeated robbery and kidnapping incidents. The US advisory specifically warns US government employees against travel to certain Quito areas.',
  'Stay in La Carolina, Quito Norte (González Suárez corridor), or Cumbayá valley for lower risk. The Centro Histórico requires a guide or organised tour — do not explore independently. Avoid La Mariscal at night. Use only app-based transport. Ecuador\'s security situation has deteriorated faster than most destination guides acknowledge — use current advisories.'),

'guayaquil': c('ec',
  'Guayaquil is rated Avoid. Ecuador\'s largest city has experienced extraordinary levels of gang warfare since 2021-23, connected to port-related narco-trafficking. The city went from a moderate-risk destination to one of South America\'s most dangerous in under three years. All three advisories have moved Ecuador to their highest-concern tiers specifically because of Guayaquil.',
  'Drive-by shootings, carjackings, kidnapping, and armed robbery occur across the city including in tourist areas. The Malecón 2000 riverfront — previously the city\'s safest public space — has experienced violent incidents. The UK FCDO and Canada advisories explicitly warn against non-essential travel to Guayaquil. Gang warfare between criminal groups (Los Lobos, Los Tiguerones) has escalated to levels not seen in Colombia or Mexico.',
  'If transiting through Guayaquil (the main international airport gateway), pre-arrange hotel pickup, do not take street taxis, and go directly to your accommodation or onward transit. Do not walk in any part of the city. The airport itself is safe; the moment you exit the airport is where risk increases dramatically.'),

// ── Peru ──────────────────────────────────────────────────────────────────────

'lima': c('pe',
  'Lima scores Moderate overall, with significant variation between the coastal Miraflores/Barranco/San Isidro tourist triangle and the wider city. The tourist-facing districts are genuinely manageable with precautions; large parts of Lima Metropolitana (Comas, Villa El Salvador, San Juan de Lurigancho) carry much higher risk. All three advisories flag Peru at elevated caution.',
  'Express kidnapping, phone theft, and robbery are well-documented in tourist areas including Miraflores waterfront (the Larcomar area). Fake taxis are a serious safety concern — all advisories specifically warn against street taxis. Pickpocketing is common on public transport and in the historic centre.',
  'Stay in Miraflores or Barranco; day trips to Centro Histórico (Plaza Mayor, Larco Museum area) should use vetted apps for transport. Avoid San Juan de Miraflores, Villa María del Triunfo, and Comas. Do not use street taxis under any circumstances. The Lima tourist experience is very manageable when confined to the safe-zone districts.'),

'arequipa': c('pe',
  'Arequipa scores Caution. Peru\'s second city — the "White City" — is a colonial heritage destination and base for Colca Canyon and El Misti. Crime levels are elevated above global baseline but more manageable than Lima. US and Canada advisories rate Peru at general elevated caution.',
  'Robbery and pickpocketing occur in the historic centre and at transport hubs (bus terminal area). Some express kidnapping incidents are documented. The city is generally safer than Lima but requires the same transport precautions.',
  'The main tourist circuit — Plaza de Armas, Santa Catalina Monastery, Yanahuara mirador — is accessible with normal precautions. Use vetted apps for all transport, especially to/from the bus terminal and airport. Avoid walking alone at night beyond the main plaza area.'),

'cusco': c('pe',
  'Cusco scores Moderate. The gateway to Machu Picchu is heavily oriented toward international tourism, and the historic centre has significant tourist police presence. Crime is primarily petty theft targeting tourists rather than violent crime. All three advisories cover Peru at general elevated caution but Cusco operates at the better end of that range.',
  'Pickpocketing in crowded markets (Mercado San Pedro), on transport to the Sacred Valley, and on the train to Aguas Calientes is the dominant risk. Mugging on the Saqsaywamán access trails and in less-lit parts of the historic centre at night is reported. Altitude sickness impairs judgment and increases vulnerability — rest on arrival.',
  'The main Plaza de Armas and adjacent streets are safe for daytime tourism. Use vetted transport for Sacred Valley tours. Keep valuables in hotel safe. Do not hike to Saqsaywamán or surrounding ruins alone or at dusk. Cusco is one of the more comfortable tourist cities in South America despite Peru\'s broader risk rating.'),

'trujillo': c('pe',
  'Trujillo scores Caution. The La Libertad capital and gateway to Chan Chan and the Moche archaeological sites has a moderate crime profile, elevated above global baseline. Gang activity from Lima-based criminal groups has reached Trujillo. US and Canada advisories cover it under Peru\'s general elevated framework.',
  'Robbery and mugging are the primary risks; the Centro Histórico has petty theft. The beaches of Huanchaco (popular with surfers) are generally safe by day. Bus terminal surroundings require caution.',
  'Trujillo is primarily a transit hub for archaeological sites. Stay near the Plaza Mayor or in Huanchaco for the calmer beach environment. Use vetted transport; do not walk alone at night in the city centre. Day trips to Chan Chan, Huaca del Sol, and Huaca de la Luna are organised through vetted agencies.'),

// ── Central America ───────────────────────────────────────────────────────────

'panamacity': c('pa',
  'Panama City scores Caution. The modern financial centre has a tourist-accessible core (Casco Viejo historic district, Punta Paitilla/Marbella business zone, Albrook mall area) alongside genuinely dangerous neighbourhoods. All three advisories flag Panama at elevated caution.',
  'Casco Viejo — the colonial old town — has been gentrifying rapidly and is patrolled, but the transition zone between Casco Viejo and El Chorillo neighbourhood (one of Panama\'s most dangerous) is abrupt. El Chorillo, Curundú, and San Miguelito carry very high crime. Taxi scams and pickpocketing in tourist areas are documented.',
  'Stay in Casco Viejo, Punta Paitilla, or Marbella for a safer experience. Do not walk from Casco Viejo into El Chorillo under any circumstances — the boundary is a one-block change from tourist to extremely high-risk. Use apps for all transport. The Canal (Miraflores Locks) and Biomuseo are safe daytime destinations with organised transport.'),

'sanjose': c('cr',
  'San José scores Caution. Costa Rica\'s capital is the country\'s most dangerous area despite the country\'s peaceful reputation. All three advisories note that crime in the greater San José area is significantly higher than elsewhere in Costa Rica, with pick-pocketing, robbery, and some carjacking documented.',
  'The Barrio Chino (Chinatown), Mercado Central, La Merced church area, and the Zona Roja (red light district) carry high theft and robbery risk. La Sabana park and Escazú are safer. Public bus use carries substantial theft risk — robberies on buses are frequently reported.',
  'Most tourists use San José only as a gateway; minimise urban dwell time. Stay in Escazú, Los Yoses, or Barrio Amón for lower risk. Use apps or pre-booked shuttles for all transport. Costa Rica\'s appeal is its national parks — the capital doesn\'t need to be the focus.'),

'sansalvador': c('sv',
  'San Salvador scores Caution. El Salvador has undergone a dramatic transformation under President Bukele\'s mass incarceration campaign since 2022: gang homicides plummeted and the country went from one of the world\'s most dangerous to a regional outlier in safety improvement. However, all three advisories still recommend elevated caution, citing concerns about the human rights context of the crackdown and residual crime.',
  'The tourist experience in the capital has meaningfully improved — the historic centre and the Zona Rosa are more accessible than at any point in the last two decades. Petty theft and some robbery persist, but the street-level MS-13/Barrio 18 extortion model that paralysed movement has been dismantled. The main caveat: the sustainability of this security model and remaining peripheral gang activity in some colonias.',
  'The Zona Rosa, San Benito, and Colonia Escalón are appropriate for standard tourist activity. The historic centre is accessible by day. Exercise normal urban precautions — apps for transport, secure valuables. The dramatic improvement since 2021 may not yet be reflected in older travel guides; current government advisories (2024-25) are the right reference.'),

'tegucigalpa': c('hn',
  'Tegucigalpa is rated Avoid. Honduras\'s capital consistently ranks among the most violent capitals in the world. Gang warfare (MS-13, 18th Street, and local Honduran groups), drug trafficking violence, and targeted killings are the backdrop. All three advisories rate Honduras at their highest risk tiers.',
  'Violence affects all parts of the city, though the Colonia Palmira diplomatic quarter and Hotel Honduras Maya area have more security infrastructure. Express kidnapping, armed robbery, and car-jacking occur even in these better-secured zones. US government employees face strict movement restrictions within the city.',
  'If visiting Honduras for family connections or essential business, use hotel-arranged vetted transport for all movements, never travel alone, avoid all transport after dark, and maintain constant contact with a local host. Leisure travel to Tegucigalpa is not recommended; most international tourists access Honduras via La Ceiba or Roatán for the Bay Islands.'),

'guatemalacity': c('gt',
  'Guatemala City is rated Avoid. The capital has very high violent crime, with gang violence, carjacking, and kidnapping affecting the metro area. All three advisories flag Guatemala at elevated caution, with specific warnings about Guatemala City itself.',
  'Zones 1, 3, and 6 (city centre, bus terminal area, Zona 3 market) are extremely dangerous and should not be visited by tourists. Even the relatively safer Zones 10 (Zona Viva/Zona Rosa) and 14-15 (Los Proceres/Cayalá area) carry Caution-level risk with occasional robbery and carjacking.',
  'Visitors should transit through Guatemala City with minimum dwell time — fly in, use vetted airport transfer to Antigua or another destination. If staying in the capital, stay in Zona 10 or 14-15, use hotel transport exclusively, and never walk on the street or use public transport. Antigua Guatemala is 45 minutes away and far safer.'),

'antigua-guatemala': c('gt',
  'Antigua Guatemala scores Moderate. This colonial city — Guatemala\'s most-visited tourist destination — has a far better security profile than Guatemala City. Tourist police patrol the cobblestone streets, and there is a visible security presence around the main plazas. All three advisories cover it under Guatemala\'s general elevated framework but do not issue city-specific escalation.',
  'Petty theft is the main risk — pickpocketing in markets (Mercado de Artesanías) and on walks to viewpoints. Robbery on Cerro de la Cruz and the Agua volcano trail has been documented; armed guards now accompany most guided ascents. The road connection to Guatemala City carries its own risk after dark.',
  'The main plaza (Parque Central), Central Park surroundings, and the tourist restaurant and hotel zone are genuinely accessible. Join guided tours for volcano ascents — do not hike independently. Travel between Antigua and Guatemala City should be with a reputable shuttle operator, not local bus.'),

'managua': c('ni',
  'Managua scores Moderate. Nicaragua under the Ortega-Murillo government has a paradoxical security profile: violent crime by street gangs is relatively low compared to neighbouring Honduras and El Salvador, partly because the government\'s security forces heavily patrol and suppress criminal activity. However, political repression is severe, and foreign nationals have been detained for political reasons.',
  'Petty theft and some robbery occur in the city\'s markets and the Carretera Masaya commercial strip. The main physical safety threat is ordinary street crime rather than gang warfare. The bigger risk for foreign nationals is unintentional political entanglement — photographing protests, security forces, or government infrastructure is dangerous.',
  'If visiting Nicaragua, exercise extreme caution about any political expression, photography of security forces or government buildings, and interaction with anyone involved in opposition activities. The physical safety from violent crime is better than most regional neighbours, but the political risk is qualitatively different.'),

// ── Caribbean & Southern cone ──────────────────────────────────────────────────

'santodomingo': c('do',
  'Santo Domingo scores Caution. The Dominican Republic capital has a tourist-accessible zone — Zona Colonial (a UNESCO World Heritage Site), Piantini, and the Malecón waterfront — alongside genuinely dangerous barrios. All three advisories note the DR at elevated caution.',
  'Robbery, pickpocketing, and some violent crime occur even in tourist zones. The Zona Colonial by day is manageable; after dark it requires more vigilance, especially away from the main pedestrian streets. Barrios like Ciudad Nueva (just behind Zona Colonial) and Los Alcarrizos carry much higher risk.',
  'Stay in Piantini, Naco, or hotels near the Malecón for a safer base. Visit Zona Colonial during daylight and return by app before dark. The DR\'s primary tourist draw (Punta Cana, Puerto Plata) operates at significantly lower risk than the capital.'),

'punta-cana': c('do',
  'Punta Cana scores Moderate. The resort enclave is one of the Caribbean\'s most-visited destinations and operates at low risk within its all-inclusive hotel corridor. All three advisories note the DR at general elevated caution but the tourist resort zone is effectively insulated.',
  'Within the resort corridor, crime is rare. The risk increases outside — the town of Higuey (30 minutes from resorts) and transport routes carry more typical Dominican Republic crime dynamics. Occasional incidents at party tourism venues (Coco Bongo, downtown Punta Cana nightlife) are documented.',
  'For all-inclusive resort visitors, this is a low-stress environment. Excursions outside the resort corridor should use organised tour operators, not independent transport. Do not hire informal guides or accept impromptu invitations from strangers in Bávaro town.'),

'santiago-caballeros': c('do',
  'Santiago de los Caballeros scores Caution. The DR\'s second city is less tourist-oriented than the capital or Punta Cana; it is primarily a commercial and agricultural hub. Crime is moderate by Dominican standards but elevated above global baseline.',
  'Robbery, pickpocketing, and some vehicle crime occur in commercial areas. The city is rarely on international tourist itineraries but is used as a base for visitors to the Cibao valley and Jarabacoa mountains.',
  'Exercise standard Dominican caution: apps for transport, valuables secured, avoid walking alone at night in the centro and market areas. The Jardines Metropolitano and commercial north zone are the more manageable parts of the city.'),

'havana': c('cu',
  'Havana scores Moderate. Cuba\'s capital has historically very low violent crime by regional standards — a legacy of the state\'s social control and economic model. However, economic desperation following the post-2020 crisis has increased petty theft and scams targeting tourists significantly. All three advisories place Cuba at elevated caution, noting the changed security context.',
  'Scams targeting tourists are now very common: jineteros (street hustlers) offering overpriced private rooms, restaurants, or transport; currency exchange scams; and taxi fraud. Pickpocketing in crowded areas and bag-snatching have increased. The more serious concern for foreign nationals: photographing security forces, protests (rare), or infrastructure without authorisation can result in detention.',
  'Havana Vieja, Vedado, and Miramar are the main visitor areas; all are manageable with vigilance. Be selective about accepting help from strangers. Use CUC taxis with metered fares. As with Nicaragua, the physical safety from violence is reasonable; the political and legal risk environment is the primary concern for Western visitors.'),

'port-au-prince': c('ht',
  'Port-au-Prince is rated Avoid at the extreme end. Haiti\'s capital is under effective gang control over large portions of the metropolitan area following state collapse. All three advisories — US, UK, and Canada — have issued their highest-level restrictions on Haiti, with the US at Level 4 (Do Not Travel). The UN characterises the security situation as near-total breakdown in some districts.',
  'Gang-controlled neighbourhoods (Cité Soleil, Bel Air, Martissant, Croix-des-Bouquets) are inaccessible. Kidnapping for ransom is rampant and affects aid workers, journalists, and ordinary travellers — not just wealthy targets. Armed ambushes on major roads are documented. The airport corridor itself has been subject to gang activity.',
  'Travel to Port-au-Prince should only occur for essential humanitarian or journalistic purposes with specialised security arrangements. All three government advisories recommend against all travel. If you must be there, use armoured vehicles, pre-arranged vetted security providers, remain in compound accommodation, and have an active extraction plan.'),

// ── Venezuela ─────────────────────────────────────────────────────────────────

'caracas': c('ve',
  'Caracas is rated Avoid at the extreme end — score 9.5. The capital of Venezuela, facing acute state collapse since the mid-2010s, has one of the world\'s highest homicide rates. All three advisories issue their highest-tier warnings for Venezuela. Infrastructure failure, economic collapse, and the breakdown of law enforcement create a compounding risk environment unlike most cities on this list.',
  'Kidnapping (both express and organised), armed robbery, car-jacking, and murder are endemic across the city including the nominally safer eastern districts (Altamira, Las Mercedes, Chacao). Even the diplomatic zone has experienced violent incidents. Police involvement in crime is documented by multiple human rights organisations and all three advisories.',
  'No part of Caracas is appropriate for leisure or independent tourism. If visiting for compelling family or humanitarian reasons, pre-arrange security through a specialist firm, use bulletproof vehicle transfers, stay in compound accommodation, never travel at night, and have an embassy contact and extraction plan active throughout. Do not attempt this without current local support.'),

'maracaibo': c('ve',
  'Maracaibo scores 9.0 — Avoid. Venezuela\'s second city sits in Zulia state, which has high gang activity and has experienced some of the most extreme deprivation from Venezuela\'s infrastructure collapse (most-referenced example: power outages lasting days). Crime, kidnapping, and armed robbery are at comparable levels to Caracas.',
  'The city has gang warfare connected to Colombia border smuggling routes and fuel theft networks. Infrastructure collapse (power, water, fuel) adds a safety dimension beyond violent crime — medical emergencies cannot be reliably responded to. All three advisories cover Venezuela at Do Not Travel level.',
  'The same guidance as Caracas applies: no leisure travel, specialist security arrangements if essential, constant emergency contact, and an extraction plan. Maracaibo is even less prepared to receive foreign visitors than Caracas due to infrastructure collapse.'),

'valencia-ve': c('ve',
  'Valencia (Carabobo) scores Avoid. Venezuela\'s third-largest city and industrial heartland has experienced the same patterns of state collapse, organised crime proliferation, and infrastructure failure as Caracas and Maracaibo. All three advisories cover Venezuela as Do Not Travel.',
  'Gang activity, kidnapping, and robbery are all documented. Industrial decline has created severe unemployment, which drives crime. Carabobo state has also experienced gang-related violence connected to Venezuelan prison power structures operating on the street.',
  'The same guidance as Caracas applies. If visiting for family or industrial/humanitarian reasons, specialist security arrangements are required. Do not travel independently.'),

'barquisimeto': c('ve',
  'Barquisimeto (Lara) scores Avoid. The "Musical Capital of Venezuela" is the country\'s fourth-largest city. Like all major Venezuelan cities, it faces elevated violent crime from state collapse dynamics, though it has historically been somewhat less violent than Caracas or Maracaibo. All three advisories cover Venezuela at their highest restriction level.',
  'Armed robbery and gang activity are documented. Infrastructure problems — power cuts, fuel shortages — add safety complications. The music and cultural scene that gave the city its reputation has severely contracted under economic conditions.',
  'Do not travel unless for essential purposes with specialist security support. The same Venezuela-wide cautions apply.'),

'maracay': c('ve',
  'Maracay (Aragua) scores Avoid. The Aragua state capital is home to the Tren de Aragua gang, which has become one of the most internationally active criminal organisations in the Americas, with documented activity across 12+ countries. At the source in Aragua state, the gang presence is at its most concentrated. All three advisories cover Venezuela at maximum restriction.',
  'Kidnapping, armed robbery, and murder at extreme rates. The Tren de Aragua operates with de facto territorial control in parts of Maracay and the wider Aragua state. Law enforcement is either unable or unwilling to challenge the group in its home territory.',
  'Tren de Aragua\'s home base makes Maracay among the highest-risk cities on this list for any visitor. Do not travel. If compelled by family connections, consult a specialist security firm with Venezuelan ground operations before making any plans.'),

// ── Bolivia ───────────────────────────────────────────────────────────────────

'lapaz': c('bo',
  'La Paz scores Caution. Bolivia\'s administrative capital (at 3,650m altitude) has a moderate crime profile — elevated above global baseline but not in the extreme tiers of Central American or Venezuelan cities. All three advisories place Bolivia at elevated caution, flagging petty crime, fake police, and transport scams as the primary tourist risks.',
  'Fake police ("millirays") — individuals posing as plainclothes officers who then demand valuables or march tourists to a fake police station — are a documented scam. Altitude sickness impairs judgement and increases vulnerability to opportunistic crime on arrival days. Pickpocketing in the Witches\' Market (Mercado de las Brujas), El Prado, and bus terminals is common.',
  'Be sceptical of anyone claiming to be a plainclothes officer — real police will not approach tourists uninvited for document checks. Rest on the first day to acclimatise. The Sopocachi and Miraflores areas are safer for accommodation. Use apps or hotel transport; do not use informal minibuses at night.'),

'cochabamba': c('bo',
  'Cochabamba scores Caution. Bolivia\'s third city and agricultural heartland has a slightly lower profile than La Paz but the same advisory framework. Drug trafficking routes through the Chapare region southeast of Cochabamba create some elevated risk context. All three advisories cover Bolivia at elevated caution.',
  'Petty theft, some robbery, and occasional express kidnapping are reported. The city\'s markets (Cancha area) and bus terminals carry elevated risk. The central plaza and restaurant zone are more manageable.',
  'Stay in the Recoleta or residential north zone for a calmer environment. Use vetted transport for the airport and bus terminal. Day trips to the Chapare coca region should use reputable tour operators. The altitude (2,558m) is more manageable than La Paz.'),

'santa-cruz': c('bo',
  'Santa Cruz de la Sierra scores Caution. Bolivia\'s largest and fastest-growing city has a more complex crime profile than La Paz, with drug trafficking-related violence becoming more prominent. The US and Canada advisories flag Bolivia at elevated caution; the UK FCDO similarly.',
  'Robbery and carjacking occur; some areas associated with trafficking networks carry high risk. The city\'s boom-town growth has outpaced governance. The central Equipetrol area and Barrio Las Palmas are more manageable; peripheral zones of the expanding metropolitan area carry higher risk.',
  'Business visitors to Santa Cruz should stay in Equipetrol or Norte. Use vetted transport. Do not walk in peripheral or market areas at night. The city is Bolivia\'s economic gateway and is used by many as a transit hub for the Amazon and Pantanal.'),

// ── Chile ─────────────────────────────────────────────────────────────────────

'santiago': c('cl',
  'Santiago scores Caution overall, but Chile remains among the safer large Latin American countries and Santiago operates notably below the regional mean. All three advisories place Chile at lower alert levels than neighbours Peru, Bolivia, or Argentina. The city\'s main tourist areas — Las Condes, Providencia, Bellavista, and Lastarria — function at effectively Moderate risk levels for visitors.',
  'Pickpocketing and bag-snatching have increased in the historic centre (Plaza de Armas, La Alameda), on Metro lines, and during the October-November demonstrations that now occur annually. Robbery has increased in some Cerro San Cristóbal and Santa Lucía hillside approaches. The Estación Central bus terminal area carries elevated risk.',
  'Most tourist activity — museums, Cerro Santa Lucía, Plaza de Armas, Barrio Italia, Lastarria — is accessible with standard urban precautions. The Estación Central area and surrounding commercial blocks require vigilance. Bellavista nightlife: arrive by app, not on foot from Centro. Chile remains one of the more navigable countries on this list.'),

'valparaiso': c('cl',
  'Valparaíso scores Caution. Chile\'s main Pacific port and UNESCO World Heritage city has higher crime than Santiago, with robbery on the cerros (hillside neighbourhoods) well-documented. All three advisories note it under Chile\'s general elevated framework.',
  'Robberies on the funicular lifts (ascensores), on hillside streets after dark, and at the bus terminal are reported. Cerro Alegre and Cerro Concepción — the main tourist hills — have heavy tourist police presence by day but require care after dark. The port area and Cerro Barón carry higher risk at most hours.',
  'Visit the UNESCO historic hillsides and Cerro Alegre/Concepción by day; leave before sunset or join a guided evening tour. The lower city (Plan) carries more standard urban risk. Use apps for return from evening dining. This is a worthwhile day-trip from Santiago with appropriate precautions.'),

'concepcion': c('cl',
  'Concepción scores Moderate. Chile\'s second city has a more industrial character than Santiago and lower tourist footfall. Crime is elevated above Santiago but below Valparaíso. All three advisories cover it under Chile\'s general framework without specific city escalation.',
  'Petty theft and some robbery occur in the city centre and around the terminal. The Barrio Universitario area near Universidad de Concepción is relatively active and safer. Talcahuano port town nearby carries higher risk.',
  'Standard urban precautions apply. For visitors en route to the Lake District or Los Ángeles, Concepción is a reasonable overnight stop with normal vigilance. The city centre is walkable by day.'),

// ── Uruguay & Paraguay ────────────────────────────────────────────────────────

'montevideo': c('uy',
  'Montevideo scores Moderate. Uruguay\'s capital is widely considered the safest major city in South America and is consistently near the top of regional quality-of-life indexes. All three advisories place Uruguay at their lowest risk level for the region — Level 1 in most frameworks, with standard precautions.',
  'Petty theft and pickpocketing occur in Ciudad Vieja (the old town) and on the Rambla waterfront promenade, but violent crime is substantially lower than anywhere else on this list. The commercial port area and surroundings of Terminal Tres Cruces (bus terminal) carry the highest theft risk.',
  'Montevideo is an excellent destination for independent travel. Ciudad Vieja, Palermo, and Punta Carretas are all walkable by day and into the evening. Use standard urban precautions. This is the most relaxed major city on the list — enjoy it.'),

'asuncion': c('py',
  'Asunción scores Caution. Paraguay\'s capital has a mixed safety profile — manageable in the historical centre and Barrio Villa Morra commercial zone, with higher risk in peripheral areas. All three advisories place Paraguay at elevated caution, with some noting the border regions with Brazil and Argentina as particularly problematic for organised crime.',
  'Petty theft and robbery occur in the historic centre and around the bus terminal. Some express kidnapping incidents are documented. Paraguay is a significant contraband corridor (electronics, fuel, counterfeit goods) and the criminal networks that support this create an elevated backdrop to urban crime.',
  'The Barrio Villa Morra and Carmelitas commercial districts are safer for visitors. The historic centre is accessible by day. Avoid the bus terminal area at night and all peripheral barrios. The main concern for transit visitors is organised crime infrastructure rather than street-level violence.'),

// ── Argentina ─────────────────────────────────────────────────────────────────

'buenos-aires': c('ar',
  'Buenos Aires scores Moderate. Argentina\'s capital is one of the more navigable major cities in South America for visitors, with Palermo, Recoleta, Belgrano, and San Telmo all accessible with standard precautions. All three advisories place Argentina at elevated caution overall, with the US advisory specifically flagging Rosario (Santa Fe province) rather than Buenos Aires for elevated crime.',
  'Express kidnapping ("secuestro virtual") — phone-based scam where callers convince families a relative is kidnapped — targets tourists. Pickpocketing in La Boca (tourist area, not residential), Constitución neighbourhood, and Once market area is common. La Boca\'s colourful Caminito street should be visited only in the indicated tourist zone; straying into residential blocks is risky.',
  'San Telmo, Palermo, Recoleta, and the Puerto Madero waterfront are all appropriate for independent tourism. La Boca: visit only the Caminito tourist strip, not after dark. Avoid Constitución and the southernmost barrios at night. Subte (metro) is safe by day; use apps in the evening. Buenos Aires is one of the more relaxed capitals for independent visitors in this region.'),

'cordoba': c('ar',
  'Córdoba scores Caution. Argentina\'s second city has a larger and more active student population than other Argentine cities (home to one of Latin America\'s oldest universities), and has moderate crime levels. All three advisories cover it under Argentina\'s general framework.',
  'Petty theft and robbery occur in the commercial centre and on night bus routes. Some outer barrios carry elevated risk. No specific Córdoba advisory escalation beyond Argentina\'s general rating.',
  'The historic centre (Cabildo, Manzana Jesuítica), Nueva Córdoba student district, and Güemes antique market area are accessible with normal urban precautions. Use apps at night. The city is a reasonable base for Quebrada de Humahuaca and the Córdoba sierras.'),

'rosario': c('ar',
  'Rosario is rated Avoid. Santa Fe province\'s major city has experienced extraordinary levels of narco-related violence since 2022-23, connected to competing criminal factions controlling the cocaine trafficking corridor. The US State Dept advisory specifically carves out the City of Rosario with elevated warning within Argentina, rating it at Level 2 while Argentina overall is Level 1. Canadian advisories similarly note Rosario.',
  'Indiscriminate shootings, murders of civilians, and cartel-style targeted killings have become frequent. Rosario\'s homicide rate in 2023-24 approached levels unseen in Argentine cities in living memory. The city\'s situation is qualitatively different from the rest of Argentina on this list.',
  'Exercise serious caution if visiting Rosario. Avoid all peripheral barrios; the central city itself carries elevated risk for random violence. Verify current security conditions before travel. If connecting through Rosario for other destinations, use direct transport without extended city stops.'),

'mendoza': c('ar',
  'Mendoza scores Moderate. The wine capital of Argentina and gateway to Aconcagua has a genuinely lower crime profile than Buenos Aires. All three advisories cover it under Argentina\'s general framework without specific escalation. The city\'s reliance on wine tourism and its walkable city centre contribute to a safer visitor environment.',
  'Petty theft occurs in the city\'s markets and Plaza Independencia area. Some peripheral barrios carry higher risk but are not tourist areas. Mendoza is frequently cited as one of Argentina\'s safer major cities.',
  'The main plaza, wine region tour circuit (Maipú, Luján de Cuyo), and trekking agencies in the city centre are accessible for independent tourism. Normal precautions apply; this is one of the more relaxed destinations on this list.'),

'bariloche': c('ar',
  'Bariloche scores Safe. This Andean lake resort and ski destination is one of the safest cities on this list. All three advisories cover Bariloche under Argentina\'s general framework, but note no specific concerns for the Patagonian lake district. Tourism-dependent economy and affluent visitor base create a very low crime environment.',
  'Petty theft — the dominant crime throughout Argentina — occurs at low frequency. There are no meaningful violent crime concerns for visitors.',
  'Bariloche is appropriate for fully independent travel. The lakeside centre, ski resorts (Cerro Catedral), and trekking in Nahuel Huapi national park are all accessible without elevated precautions. This is the most relaxed risk environment on this list after Punta Cana.'),

// ── Puerto Rico ───────────────────────────────────────────────────────────────

'san-juan': c('pr',
  'San Juan scores Moderate. As a US territory, Puerto Rico operates with US law enforcement frameworks and a different risk context from Latin American countries. The tourist areas — Old San Juan, Condado, Isla Verde — function at manageable levels. However, some Puerto Rican neighbourhoods (notably La Perla, immediately adjacent to Old San Juan\'s walls) have significant gang and drug activity.',
  'Theft from rental cars at beaches is very common — do not leave anything visible in a parked vehicle. La Perla, despite being famous as the filming location for a notable music video, is an active gang territory and should not be entered on foot by tourists. Some interior municipalities carry elevated crime.',
  'Old San Juan\'s tourist streets, the Condado beach hotel corridor, and Isla Verde are all accessible with standard precautions. La Perla: do not enter. Rental car break-ins at beaches: leave nothing visible. San Juan operates significantly more safely than mainland Latin American cities at the same score — the similarity is in petty theft rather than violent crime.'),

};

// ── Write all content files ────────────────────────────────────────────────────
// After writing hardcoded content, augment with official crime data sourced from
// seo/sources/{city}.json (crime_data class entries with real excerpts).

const OUT_DIR    = path.join(ROOT, 'seo', 'content');
const SRC_DIR    = path.join(ROOT, 'seo', 'sources');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
for (const [key, content] of Object.entries(CONTENT)) {
  // Augment with crime_data excerpts from source files
  const srcPath = path.join(SRC_DIR, `${key}.json`);
  if (fs.existsSync(srcPath)) {
    try {
      const sources = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
      const crimeData = sources.filter(s => s.source_class === 'crime_data' && s.excerpt);
      if (crimeData.length > 0) {
        const dataNote = crimeData.map(s => s.excerpt).join(' ');
        content.reconciliation.push({ text: `Official statistics: ${dataNote}` });
        content.sources_used = [...(content.sources_used || []), ...crimeData.map(s => s.id)];
      }
    } catch (e) { /* ignore malformed source files */ }
  }

  fs.writeFileSync(path.join(OUT_DIR, `${key}.json`), JSON.stringify(content, null, 2));
  written++;
}

console.log(`Wrote ${written} content files to seo/content/`);
console.log('Run npm run seo && npm run build to rebuild all city pages.');
