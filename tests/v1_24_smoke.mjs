import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {convertPressure,formatPressure,mountPressureConverter} from '../ewp-tools/snow-load/pressure-converter.mjs';
import {calculateSnow,KPA_TO_PSF} from '../ewp-tools/snow-load/calc.mjs';
let assertions=0;
const check=(description,fn)=>{fn();assertions++;console.log('PASS',description);};
function approx(actual,expected,tolerance=1e-7){assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);}
check('one kPa equals 20.885434273 psf',()=>approx(convertPressure('1','kpa'),20.885434273,1e-10));
check('one psf equals 0.0478802589 kPa',()=>approx(convertPressure('1','psf'),1/20.885434273,1e-10));
check('ratio shared with existing Snow Load Calculator',()=>assert.equal(KPA_TO_PSF,20.885434273));
check('round trip kPa to psf to kPa',()=>approx(convertPressure(convertPressure('2.34567','kpa'),'psf'),2.34567));
check('negative pressures permitted',()=>approx(convertPressure('-3','kpa'),-3*KPA_TO_PSF));
check('zero pressure is zero',()=>assert.equal(convertPressure('0','psf'),0));
check('blank pressure distinguished from zero',()=>assert.equal(convertPressure('','kpa'),null));
check('whitespace pressure is blank',()=>assert.equal(convertPressure('  ','psf'),null));
check('invalid alphabetic entry rejected',()=>assert.ok(Number.isNaN(convertPressure('oops','kpa'))));
check('invalid partial entry rejected',()=>assert.ok(Number.isNaN(convertPressure('.','psf'))));
check('Infinity rejected',()=>assert.ok(Number.isNaN(convertPressure('Infinity','kpa'))));
check('scientific notation accepted',()=>approx(convertPressure('1e2','kpa'),100*KPA_TO_PSF));
check('bad unit rejected',()=>assert.throws(()=>convertPressure('1','psi'),RangeError));
check('format psf 1 kPa',()=>assert.equal(formatPressure(convertPressure('1','kpa'),'psf'),'20.8854'));
check('format kPa 1 psf',()=>assert.equal(formatPressure(convertPressure('1','psf'),'kpa'),'0.04788'));
check('format zero retained',()=>assert.equal(formatPressure(0,'kpa'),'0'));
check('format very small value not falsely zero',()=>assert.notEqual(formatPressure(0.00000001,'kpa'),'0'));
check('format negative pressure',()=>assert.equal(formatPressure(-10,'psf'),'-10'));
class MockNode{
 constructor(value=''){this.value=value;this.textContent='';this.listeners={};this.focusCalled=false;}
 addEventListener(evt,fn){this.listeners[evt]=fn;}
 dispatch(evt){this.listeners[evt]?.();}
 focus(){this.focusCalled=true;}
}
const kpa=new MockNode('1'),psf=new MockNode('20.8854'),clear=new MockNode(),msg=new MockNode();
const unrelated={snowSs:new MockNode('2.6'),snowSr:new MockNode('0.3'),snowCb:new MockNode('0.8'),snowResultKpa:new MockNode('2.38 kPa')};
const doc={getElementById(id){return {pressureKpa:kpa,pressurePsf:psf,pressureClear:clear,pressureMessage:msg,...unrelated}[id]||null;}};
check('mount UI using converter only',()=>assert.equal(mountPressureConverter(doc),true));
check('typing kPa converts psf',()=>{kpa.value='2';kpa.dispatch('input');assert.equal(psf.value,'41.7709');});
check('typing psf converts kPa',()=>{psf.value='50';psf.dispatch('input');assert.equal(kpa.value,'2.394013');});
check('source input not rewritten',()=>assert.equal(psf.value,'50'));
check('typing invalid value clears other field',()=>{kpa.value='ABC';kpa.dispatch('input');assert.equal(psf.value,'');assert.ok(msg.textContent);});
check('clearing one input clears other and error',()=>{kpa.value='';kpa.dispatch('input');assert.equal(psf.value,'');assert.equal(msg.textContent,'');});
check('clear button clears values and focuses kPa',()=>{kpa.value='10';psf.value='208.8543';clear.dispatch('click');assert.equal(kpa.value,'');assert.equal(psf.value,'');assert.ok(kpa.focusCalled);});
check('unrelated snow load inputs and output unchanged',()=>{assert.deepEqual(Object.entries(unrelated).map(([id,n])=>[id,n.value]),[['snowSs','2.6'],['snowSr','0.3'],['snowCb','0.8'],['snowResultKpa','2.38 kPa']]);});
check('snow calculation unchanged',()=>assert.equal(calculateSnow(2.6,.3,.8).kpa,2.38));
const html=readFileSync(new URL('../ewp-tools/snow-load/index.html',import.meta.url),'utf8');
check('converter is structurally outside snow calculation panel',()=>assert.match(html,/<\/section>\s*<div class="snow-converter-separator"[\s\S]*?<section class="tools-panel snow-converter-panel"/));
check('converter script installed once',()=>assert.equal((html.match(/pressure-converter\.mjs\?v=1\.24/g)||[]).length,1));
check('converter visible under existing snow result',()=>assert.ok(html.indexOf('id="pressureKpa"')>html.indexOf('id="snowResultKpa"')));
console.log(`V1.24 converter: ${assertions} assertions passed`);
