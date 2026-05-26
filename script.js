<form id="leadForm" onsubmit="submitLead(event)">

    <input id="first_name" placeholder="First Name" required />
    <input id="last_name" placeholder="Last Name" required />
    <input id="email" placeholder="Email" required />

    <input id="company_name" placeholder="Company Name" />

    <select id="annual_revenue_range">
        <option value="">Select Revenue Range</option>
        <option value="0-100k">0 - 100k</option>
        <option value="100k-500k">100k - 500k</option>
        <option value="500k-1m">500k - 1M</option>
        <option value="1m+">1M+</option>
    </select>

    <input id="primary_area_of_interest" placeholder="Service Area" />

    <textarea id="challenge_description" placeholder="What are you working through?"></textarea>

    <button type="submit">Submit</button>

</form>