package edu.ucsb.nceas.metacatui.proxy;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.Charset;

import javax.servlet.Servlet;
import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.IOUtils;

/**
 * A proxy class that passes requests from the client through to the appropriate DataONE
 * service endpoint. This class is used to provide a single point of communication
 * for clients even when a client may want to communicate with multiple service providers
 * but is prevented from doing so due to the single origin policy for web clients.
 */
public class DataONEProxy extends HttpServlet {
	private static final long serialVersionUID = 1L;

    /**
     * Default constructor. 
     */
    public DataONEProxy() {
        // TODO Auto-generated constructor stub
    }

	/**
	 * @see Servlet#init(ServletConfig)
	 */
	public void init(ServletConfig config) throws ServletException {
	    System.out.println("DataONE proxy servlet starting...");
	}

	/**
	 * @see HttpServlet#doGet(HttpServletRequest request, HttpServletResponse response)
	 */
	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        System.out.println(request.getRequestURI());
	    String resource = request.getPathInfo();
	    System.out.println(resource);
        resource = resource.substring(resource.indexOf("/") + 1);
        System.out.println(resource);
        Writer w = null;
        String encoding = "UTF-8";
        
        // default to node info
        if (resource.equals("")) {
            resource = "query";
        }
          
        if (resource != null) {
            if (resource.startsWith("view")) {
                // TODO: handle a View request
                resource = resource.substring(resource.indexOf("/") + 1);
                response.setContentType("text/html");
    			w = new OutputStreamWriter(response.getOutputStream(), encoding);
                w.write("<h1>View document: " + resource + "</h1>\n");
                w.close();
            } else {
                response.setContentType("application/json");
                String rows = request.getParameter("rows");
    			w = new OutputStreamWriter(response.getOutputStream(), encoding);
                w.write(proxyQuery(request.getParameter("fl"), request.getParameter("q"), request.getParameter("sort"), request.getParameter("start"), request.getParameter("rows")));
                w.close();
            }
        }	    
	}

	/**
	 * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
	 */
	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		// TODO Auto-generated method stub
	}

	/**
	 * @see HttpServlet#doPut(HttpServletRequest, HttpServletResponse)
	 */
	protected void doPut(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		// TODO Auto-generated method stub
	}

	/**
	 * @see HttpServlet#doDelete(HttpServletRequest, HttpServletResponse)
	 */
	protected void doDelete(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		// TODO Auto-generated method stub
	}

	private String proxyQuery(String fields, String query, String sort, String start, String rows) {
	    return search(fields, query, sort, start, rows);
	    //return simulateSearch(start, rows);
	}

	private String search(String fields, String queryString, String sort, String start, String rows) {
	    String result="";
	    InputStream is = null;
	        try {
	            //String uri = "https://cn.dataone.org/cn/v1/query/solr/?fl=id,title,origin,pubDate,abstract&q=formatType:METADATA+-obsoletedBy:*&wt=json" + "&rows=" + rows + "&start=" + start;
	            //              https://cn.dataone.org/cn/v1/query/solr/?fl=id%2Ctitle%2Corigin%2CpubDate%2CdateUploaded%2Cabstract&q=formatType%3AMETADATA+-obsoletedBy%3A*+jones&sort=dateUploaded+desc&wt=json&rows=10&start=0
                //String uri = "https://cn.dataone.org/cn/v1/query/solr/?fl="+ URLEncoder.encode(fields) + "&q="+ URLEncoder.encode(queryString) + "&sort=" + URLEncoder.encode(sort) + "&wt=json" + "&rows=" + URLEncoder.encode(rows) + "&start=" + URLEncoder.encode(start);
	            String uri = "http://localhost:8080/knb/d1/mn/v1/query/solr/fl="+ URLEncoder.encode(fields) + "&q="+ URLEncoder.encode(queryString) + "&sort=" + URLEncoder.encode(sort) + "&wt=json" + "&rows=" + URLEncoder.encode(rows) + "&start=" + URLEncoder.encode(start);
	            System.out.println("Query URL: " + uri);
	            URI query = new URI(uri);
	            URL url = query.toURL();
	            is = url.openStream();
	            result = IOUtils.toString(is, Charset.forName("UTF-8"));
	        } catch (URISyntaxException e) {
	            // TODO Auto-generated catch block
	            e.printStackTrace();
	        } catch (IOException e) {
	            // TODO Auto-generated catch block
	            e.printStackTrace();
	        } finally {
	            try {
	                is.close();
	            } catch (IOException e) {
	                // TODO Auto-generated catch block
	                e.printStackTrace();
	            }
	        }
	        return result;
	}
	
	private String simulateSearch(String start, String rows) {
	    String updatedSimData = "";
	    InputStream is = this.getClass().getResourceAsStream("/solr-data-CN.json");
	    //String resname =  "/solr-data-" + rows + ".json";
	    //InputStream is = this.getClass().getResourceAsStream(resname);
	    try {
	        String updatedYear = 2012 + start;
            String simData = IOUtils.toString(is, Charset.forName("UTF-8"));
            // change the result start record number
            System.out.println("Start is: " + start);
            System.out.println(" Rows is: " + rows);
            updatedSimData = simData.replaceAll("\"start\":\"0\"", "\"start\":\"" + start + "\"").replaceAll("\"start\":0", "\"start\":" + start).replaceAll("2012", updatedYear).replaceAll("AA", start);
            is.close();
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            if (is != null) {
                try {
                    is.close();
                } catch (IOException e) {
                    // TODO Auto-generated catch block
                    e.printStackTrace();
                }
            }
        }
	    return updatedSimData;
	}
}
