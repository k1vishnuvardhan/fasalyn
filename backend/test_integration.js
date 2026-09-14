import { strict as assert } from 'assert'
import { randomUUID } from 'crypto'

async function runTests() {
  console.log('Starting integration tests...')
  const api = 'http://localhost:4000/api'
  let user, token, farmId, plotId

  try {
    // 1. Register a test user
    const email = `test-${Date.now()}@example.com`
    console.log('Registering user:', email)
    const regRes = await fetch(`${api}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password1234', name: 'Test Farmer' })
    })
    const reg = await regRes.json()
    assert.equal(regRes.status, 201)
    assert.ok(reg.token)
    token = reg.token
    user = reg.user
    console.log('User registered OK.')

    // 2. Create Farm
    console.log('Creating farm...')
    const farmIdReq = randomUUID()
    const farmRes = await fetch(`${api}/farms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: farmIdReq, name: 'My Test Farm', crop: 'Chilli' })
    })
    const farm = await farmRes.json()
    assert.equal(farmRes.status, 201)
    assert.equal(farm.id, farmIdReq)
    assert.equal(farm.name, 'My Test Farm')
    farmId = farm.id
    console.log('Farm created OK.')

    // 3. Save Farm Boundary (Map My Farm feature)
    console.log('Saving farm boundary...')
    const polygon = {
      type: 'Polygon',
      coordinates: [[[78.4867, 17.3850], [78.4868, 17.3850], [78.4868, 17.3851], [78.4867, 17.3850]]]
    }
    const boundRes = await fetch(`${api}/farms/${farmId}/boundary`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ polygonGeometry: polygon })
    })
    const updatedFarm = await boundRes.json()
    assert.equal(boundRes.status, 200)
    assert.ok(updatedFarm.areaSquareMeters > 0)
    assert.equal(updatedFarm.monitoringMode, 'SPATIAL')
    console.log('Farm boundary saved OK. Area:', updatedFarm.areaSquareMeters)

    // 4. Create Plot
    console.log('Creating plot...')
    const plotIdReq = randomUUID()
    const plotRes = await fetch(`${api}/farms/${farmId}/plots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: plotIdReq, name: 'Plot 1', crop: 'Chilli' })
    })
    const plot = await plotRes.json()
    assert.equal(plotRes.status, 201)
    assert.equal(plot.id, plotIdReq)
    plotId = plot.id
    console.log('Plot created OK.')

    // 5. Add Trap Observation
    console.log('Adding trap observation...')
    const trapRes = await fetch(`${api}/traps/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plotId, trapType: 'Sticky', pest: 'Thrips', count: 12, observedAt: new Date().toISOString() })
    })
    const trap = await trapRes.json()
    assert.equal(trapRes.status, 201)
    console.log('Trap observation added OK.')

    // 6. Get Spatial Health (Tests Risk Engine & Nearby Cases)
    console.log('Getting spatial health...')
    const healthRes = await fetch(`${api}/farms/${farmId}/spatial-health`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const health = await healthRes.json()
    assert.equal(healthRes.status, 200)
    assert.ok(health.plots.length === 1)
    assert.ok(health.plots[0].trapObservations.length === 1)
    assert.ok(health.plots[0].latestRisk)
    console.log('Spatial health retrieved OK.')

    console.log('All core tests passed successfully!')

    // 7. Test Demo Isolation
    console.log('Testing demo isolation...')
    const demoEmail = `demo-${Date.now()}@example.com`
    const demoRegRes = await fetch(`${api}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: demoEmail, password: 'password1234', name: 'Demo Farmer', environment: 'demo' })
    })
    const demoReg = await demoRegRes.json()
    assert.equal(demoRegRes.status, 201)
    assert.equal(demoReg.user.environment, 'demo')
    const demoToken = demoReg.token

    const demoFarmRes = await fetch(`${api}/farms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${demoToken}` },
      body: JSON.stringify({ id: randomUUID(), name: 'Demo Farm', crop: 'Cotton' })
    })
    const demoFarm = await demoFarmRes.json()
    assert.equal(demoFarmRes.status, 201)

    // Make regular user an officer to query farms
    const { run } = await import('./db.js')
    await run('UPDATE users SET role=? WHERE id=?', ['OFFICER', user.id])
    
    // Regular officer should NOT see demo farm
    const offRes = await fetch(`${api}/officer/farms`, { headers: { Authorization: `Bearer ${token}` } })
    const offFarms = await offRes.json()
    assert.ok(!offFarms.some(f => f.id === demoFarm.id), 'Production officer should not see demo farm')

    // Demo user should be able to reset their environment
    const resetRes = await fetch(`${api}/demo/reset`, { method: 'DELETE', headers: { Authorization: `Bearer ${demoToken}` } })
    assert.equal(resetRes.status, 200)
    
    // Verify reset
    const demoFarmCheck = await fetch(`${api}/farms`, { headers: { Authorization: `Bearer ${demoToken}` } })
    const demoFarms = await demoFarmCheck.json()
    assert.equal(demoFarms.length, 0, 'Demo reset should delete demo farms')

    console.log('Demo isolation tests passed successfully!')

  } catch (err) {
    console.error('Test failed:', err)
    process.exitCode = 1
  }
}

runTests()
