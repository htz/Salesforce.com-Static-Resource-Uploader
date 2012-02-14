<tr id="${id}" class="dataRow">
<td class="dataCell">
	<input class="dosave" type="button" value="Save" /><br />
	<input class="cancel" type="button" value="Cancel" />
</td>
<td class="dataCell">{{html file.name}}</td>
<td class="dataCell">
	<input class="developerName" type="text" value="${file.name.replace(/\W+/g, '_')}" />
</td>
<td class="dataCell"><textarea class="description"></textarea></td>
<td class="dataCell">{{html file.type}}</td>
<td class="dataCell image">
{{if image}}
	<img id="img_${id}" class="thumbnail" src="${image}" />
{{/if}}
</td>
<td class="dataCell numericalColumn size">${$.commaStyle(file.size)}</td>
<td class="dataCell">
	<select class="cacheControl">
		<option value="0">Private</option>
		<option value="1">Public</option>
	</select>
</td>
<td class="dataCell error"></td>
</tr>
